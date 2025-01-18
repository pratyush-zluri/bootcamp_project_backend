import { MikroORM } from "@mikro-orm/postgresql";
import config from "../../mikro-orm.config";
import { Transaction } from "../entities/transactions";
export default async function initORM() {
    try {
        const orm = await MikroORM.init({
            ...config,
            entities: [Transaction]
        });
        return orm.em.fork();
    } catch (err) {
        console.error("Error initializing ORM:", err);
        throw new Error("Database connection error");
    }
}