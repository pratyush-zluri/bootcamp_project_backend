import { Migration } from '@mikro-orm/migrations';

export class Migration20250108121645 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "transaction" ("id" serial primary key, "date" date not null, "description" varchar(255) not null, "original_amount" real not null, "currency" varchar(255) not null, "amount_in_inr" real not null);`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "transaction" cascade;`);
  }

}
