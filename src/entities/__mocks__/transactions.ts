export class Transaction {
    id!: number;
    date!: Date;
    description!: string;
    currency!: string;
    originalAmount!: number;
    amount_in_inr!: number;
    isDeleted!: boolean;
}