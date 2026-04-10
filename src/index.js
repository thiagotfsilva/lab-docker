const e = require('express');
const express = require('express');
const mysql2 = require('mysql2');''

const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/test-db', async function (req, res) {
    const connection = mysql2.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    connection.connect(err => { 
        if (err) {
            console.error('Error connecting to database:', err);
            return;
        }

        res.send('Connected to database successfully!');
    });
});

app.get('/external-api', async function(req, res){
  //const address = 'http://host.docker.internal:9000/products';
  const address = 'http://external-api:9000/products';
  const response = await fetch(address)
  const data = await response.json()
  res.send(data)
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});