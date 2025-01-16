"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const transactionRoutes_1 = __importDefault(require("./routes/transactionRoutes"));
require("reflect-metadata");
const port = 3000;
const app = (0, express_1.default)();
app.use(body_parser_1.default.json());
app.use((0, cors_1.default)());
app.use('/', transactionRoutes_1.default);
app.listen(port, () => {
    console.log(`App is running on port ${port}`);
});
