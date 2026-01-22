import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import * as path from "path";

dotenv.config();

const app: Express = express();
const port = process.env.PORT ?? 3000;

app.use(express.static(path.join(__dirname,"..","public")));

app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.get("/", (req: Request, res: Response) => {
  res.send(`<html>
               <head>
                    <link rel="stylesheet" href="roulette.css" />
                    <title> Coucou les meef </title>
               </head>
               <body> 
                   <h1>Un cours pour voir HTTP</h1>
                   <p>Avec un serveur Express</p>
               </body>
            </html> 
           `);
});

app.get("/roulette.css", (req : Request, res : Response) => {
    const randomColor = '#' + Math.floor(Math.random()*1677)
    
    res.send(`
              body {
                  background-color: ${randomColor};
                  color : white;
              }  
             `
    )
})

app.all("/add", (req: Request, res: Response) => {
  const a = Number(req.body.a ?? req.query.a);
  const b = Number(req.body.b ?? req.query.b);
  if (Number.isNaN(a) || Number.isNaN(b)) {
    res.status(400).json({ error: "Invalid numbers" });
    return;
  }
  const sum = a + b;
  res.json({ result: sum });
});


app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
