// orm.ts
import { MikroORM } from "@mikro-orm/postgresql";
import config from "../../mikro-orm.config";
import { Transaction } from "../entities/transactions";
let orm: MikroORM;

export default async function initORM() {
    if (!orm) {
        orm = await MikroORM.init({
            ...config,
            entities: [Transaction],
            debug: false, // Disable verbose logging for performance
            pool: {
                min: 2, // Connection pooling
                max: 10,
            },
        });
    }
    return orm.em.fork();
}
