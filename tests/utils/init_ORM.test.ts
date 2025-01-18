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
            entities: [Transaction]
        });

        // Check if em.fork was called
        expect(mockFork).toHaveBeenCalled();

        // Check if the function returns the forked EntityManager
        expect(result).toBe("mocked-em-fork");
    });

    it("should throw error when ORM initialization fails", async () => {
        // Mock initialization failure
        const testError = new Error("Test database error");
        mockedInit.mockRejectedValue(testError);

        // Mock console.error to prevent error output during tests
        const consoleSpy = jest.spyOn(console, "error").mockImplementation();

        // Check if the function throws the expected error
        await expect(initORM()).rejects.toThrow("Database connection error");

        // Verify error was logged
        expect(consoleSpy).toHaveBeenCalledWith("Error initializing ORM:", testError);

        // Restore console.error
        consoleSpy.mockRestore();
    });

    it("should call MikroORM.init with the correct configuration", async () => {
        // Mock successful initialization with empty em
        mockedInit.mockResolvedValue({
            em: { fork: () => ({}) }
        } as unknown as MikroORM);

        await initORM();

        // Verify init was called with expected config
        expect(mockedInit).toHaveBeenCalledWith(expect.objectContaining({
            ...config,
            entities: [Transaction]
        }));
    });
});