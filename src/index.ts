import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import router from './routes/transactionRoutes'

const port=3000;
const app=express();

app.use(bodyParser.json());
app.use(cors())
app.use('/', router);


app.listen(port, ()=>{
    console.log(`App is running on port ${port}`);
})