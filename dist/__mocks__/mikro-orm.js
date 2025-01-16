"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MikroORM = exports.Property = exports.PrimaryKey = exports.Entity = void 0;
// __mocks__/mikro-orm.ts
const Entity = () => (target) => target;
exports.Entity = Entity;
const PrimaryKey = () => (target, propertyKey) => { };
exports.PrimaryKey = PrimaryKey;
const Property = () => (target, propertyKey) => { };
exports.Property = Property;
exports.MikroORM = {
    init: jest.fn().mockResolvedValue({
        em: {
            fork: jest.fn().mockReturnValue({
                persist: jest.fn(),
                flush: jest.fn(),
                find: jest.fn(),
                count: jest.fn(),
                remove: jest.fn(),
                findOne: jest.fn(),
            }),
        },
        close: jest.fn(),
    }),
};
