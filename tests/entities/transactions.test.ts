import { MikroORM, EntityManager } from '@mikro-orm/core';
import { Transaction } from '../../src/entities/transactions';
import config from '../../mikro-orm.config';

describe('Transaction Entity', () => {
  let orm: MikroORM;
  let em: EntityManager;

  beforeAll(async () => {
    orm = await MikroORM.init(config);
    em = orm.em.fork();
  });

  afterAll(async () => {
    await orm.close(true);
  });

  it('should create a new transaction entity', async () => {
    const transaction = new Transaction();
    transaction.date = new Date('2025-01-15');
    transaction.description = 'Test Transaction';
    transaction.originalAmount = 100.0;
    transaction.currency = 'USD';
    transaction.amount_in_inr = 7500.0;
    transaction.isDeleted = false;

    await em.persistAndFlush(transaction);
    const savedTransaction = await em.findOne(Transaction, { description: 'Test Transaction' });

    expect(savedTransaction).toBeDefined();
    expect(savedTransaction!.date).toEqual(new Date('2025-01-15'));
    expect(savedTransaction!.description).toBe('Test Transaction');
    expect(savedTransaction!.originalAmount).toBe(100.0);
    expect(savedTransaction!.currency).toBe('USD');
    expect(savedTransaction!.amount_in_inr).toBe(7500.0);
    expect(savedTransaction!.isDeleted).toBe(false);
  });

  it('should update an existing transaction entity', async () => {
    const transaction = await em.findOne(Transaction, { description: 'Test Transaction' });
    if (transaction) {
      transaction.description = 'Updated Transaction';
      await em.persistAndFlush(transaction);

      const updatedTransaction = await em.findOne(Transaction, { description: 'Updated Transaction' });
      expect(updatedTransaction).toBeDefined();
      expect(updatedTransaction!.description).toBe('Updated Transaction');
    }
  });

  it('should soft delete a transaction entity', async () => {
    const transaction = await em.findOne(Transaction, { description: 'Updated Transaction' });
    if (transaction) {
      transaction.isDeleted = true;
      await em.persistAndFlush(transaction);

      const deletedTransaction = await em.findOne(Transaction, { description: 'Updated Transaction' });
      expect(deletedTransaction).toBeDefined();
      expect(deletedTransaction!.isDeleted).toBe(true);
    }
  });

  it('should remove a transaction entity', async () => {
    const transaction = await em.findOne(Transaction, { description: 'Updated Transaction' });
    if (transaction) {
      await em.removeAndFlush(transaction);

      const removedTransaction = await em.findOne(Transaction, { description: 'Updated Transaction' });
      expect(removedTransaction).toBeNull();
    }
  });
});