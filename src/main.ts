import { Logger } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module.js"

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ["error", "warn", "log"],
    })

    const logger = new Logger("Bootstrap")
    logger.log("Discord/Telegram bot application started")

    app.enableShutdownHooks()
}

bootstrap().catch((error) => {
    console.error(error)
    process.exit(1)
})
