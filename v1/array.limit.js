if (!Array.prototype.limit)
    Array.prototype.limit = function (limit = 0) {
        const _ret = []

        if (limit) {
            for (let i = 0; i < this.length; i++) {
                if (i < limit) {
                    _ret.push(this[i])
                }
            }
        }

        return _ret
    }
