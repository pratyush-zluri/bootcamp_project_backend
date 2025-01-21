// tests/utils/init_ORM.test.ts
import { MikroORM } from "@mikro-orm/postgresql";
import { Transaction } from "../../src/entities/transactions";
import initORM from "../../src/utils/init_ORM";  // Adjust the import path as needed
import config from "../../mikro-orm.config";

// Mock MikroORM with proper typing
jest.mock("@mikro-orm/postgresql", () => ({
    MikroORM: {
        init: jest.fn() as jest.MockedFunction<typeof MikroORM.init>
    }
}));

// Get the mocked version of init with proper typing
const mockedInit = jest.mocked(MikroORM.init);

describe("initORM", () => {
    // Clear all mocks before each test
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should successfully initialize ORM and return EntityManager fork", async () => {
        // Mock successful initialization
        const mockFork = jest.fn();
        const mockEntityManager = { fork: mockFork };
        mockFork.mockReturnValue("mocked-em-fork");

        mockedInit.mockResolvedValue({
            em: mockEntityManager
        } as unknown as MikroORM);

        const result = await initORM();

        // Check if MikroORM.init was called with correct config
        expect(mockedInit).toHaveBeenCalledWith({
            ...config,
            entities: [Transaction],
            debug: false, // Ensure debug is false
            pool: {
                min: 2,
                max: 10,
            }
        });

        // Check if em.fork was called
        expect(mockFork).toHaveBeenCalled();

        // Check if the function returns the forked EntityManager
        expect(result).toBe("mocked-em-fork");
    });

});