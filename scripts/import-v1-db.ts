import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DataSource } from 'typeorm';
import { EmojiToRole } from '../src/database/entities/emoji-to-role.entity';
import { CreateEmojiToRoles1738281600000 } from '../src/database/migrations/1738281600000-CreateEmojiToRoles';

interface V1DbJson {
  emojiToRoles?: Array<{
    guildId: string;
    role: string;
    emoji: string;
    messageId: string;
    removeAllRoles?: boolean;
  }>;
}

async function main() {
  const dbPath = process.env.DB_PATH ?? './data/bot.sqlite';
  mkdirSync(dirname(dbPath), { recursive: true });

  const dataSource = new DataSource({
    type: 'better-sqlite3',
    database: dbPath,
    entities: [EmojiToRole],
    migrations: [CreateEmojiToRoles1738281600000],
    migrationsRun: true,
    synchronize: false,
  });

  await dataSource.initialize();

  const v1Path = join(process.cwd(), 'v1', 'db.json');
  const raw = await import('node:fs/promises').then((fs) =>
    fs.readFile(v1Path, 'utf-8'),
  );
  const v1Data = JSON.parse(raw) as V1DbJson;
  const rules = v1Data.emojiToRoles ?? [];

  const repo = dataSource.getRepository(EmojiToRole);
  let imported = 0;

  for (const rule of rules) {
    const exists = await repo.findOne({
      where: {
        guildId: rule.guildId,
        roleId: rule.role,
        emoji: rule.emoji,
        messageId: rule.messageId,
      },
    });

    if (exists) {
      continue;
    }

    await repo.save(
      repo.create({
        guildId: rule.guildId,
        roleId: rule.role,
        emoji: rule.emoji,
        messageId: rule.messageId,
        removeAllRoles: rule.removeAllRoles ?? false,
      }),
    );
    imported++;
  }

  console.log(`Imported ${imported} rule(s) from v1/db.json`);
  await dataSource.destroy();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
