import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import router from './routes/transactionRoutes'
import 'reflect-metadata';
import initORM from './utils/init_ORM';


const port = 3000;
const app = express();

app.use(bodyParser.json());
app.use(cors())
app.use('/', router);



app.listen(port, async () => {
    const em = await initORM();
    console.log(`App is running on port ${port}`);
})