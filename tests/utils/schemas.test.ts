import { new_schema, update_schema } from '../../src/utils/schemas';  // Adjust import path as needed

describe('Transaction Schemas Validation', () => {
    describe('new_schema', () => {
        it('should validate correct transaction data', () => {
            const validData = {
                description: 'Grocery shopping',
                originalAmount: 100.50,
                currency: 'USD',
                date: '2024-01-18'
            };

            const { error } = new_schema.validate(validData);
            expect(error).toBeUndefined();
        });
    });

    describe('update_schema', () => {
        it('should validate complete valid update data', () => {
            const validData = {
                description: 'Updated description',
                originalAmount: 200.50,
                currency: 'EUR',
                date: '2024-01-18'
            };

            const { error } = update_schema.validate(validData);
            expect(error).toBeUndefined();
        });

        it('should validate partial update with only some fields', () => {
            const partialData = {
                description: 'Updated description',
                currency: 'EUR'
            };

            const { error } = update_schema.validate(partialData);
            expect(error).toBeUndefined();
        });

        it('should validate empty update object', () => {
            const emptyUpdate = {};

            const { error } = update_schema.validate(emptyUpdate);
            expect(error).toBeUndefined();
        });
    });
});