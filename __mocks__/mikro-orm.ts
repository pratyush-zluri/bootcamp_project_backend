// __mocks__/mikro-orm.ts
export const Entity = () => (target: any) => target;
export const PrimaryKey = () => (target: any, propertyKey: string) => {};
export const Property = () => (target: any, propertyKey: string) => {};

export const MikroORM = {
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