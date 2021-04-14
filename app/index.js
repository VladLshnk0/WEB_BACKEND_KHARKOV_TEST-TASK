const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const multer = require('multer');

const app = express();
const urlencodedParser = bodyParser.urlencoded({extended: false});

var isAuthenticated = false; //переменная для проверки, была ли произведена аутентификация
var currentUserID = undefined;

app.set("view engine", "hbs");

//Создание подключения к БД
const pool = mysql.createPool({
    host:"localhost",
    user: "root",
    database: "task",
    password: "pass",
});


app.get("/", function(req, resp){
    resp.render("index.hbs");
});

app.get("/registration", function(req, resp){
    resp.render("registration.hbs");
});

//Получаем данные от пользователя, которые были введены внутри тега body registration.hbs 
app.post("/registration", urlencodedParser, function(req, resp){
    if(!req.body) return resp.sendStatus(422); //Проверка, не были ли введены пустые данные
    const name = req.body.name;
    const email = req.body.email;
    const pass = req.body.pass;
    const number = req.body.number;

    //Сохраняем полученные данные в БД и переходим на страницу пользователя, который зарегестрировался
    pool.query("INSERT INTO users(name, email, pass, number) VALUES(?,?,?,?)", [name, email, pass, number], function(err, data){
        if(err) return console.log(err);
        resp.redirect("user");
    })
});

app.get("/login", function(req, resp){
    resp.render("login.hbs");
});

//Сверяем данные, введенные пользователем, с данными, сохраненными в БД
app.post("/login", urlencodedParser, function(req, resp){
    if(!req.body) return resp.sendStatus(422); //Проверка, не были ли введены пустые данные

    //Получаем данные от пользователя
    const email = req.body.email;
    const pass = req.body.pass;

    //Достаем данные из БД
    pool.query("SELECT * FROM USERS WHERE EMAIL=? AND PASS=?", [email, pass], function(err, data){
        if(err) console.log(err);

        //Получаем данные из БД
        const emailFromDB = data[0].EMAIL;
        const passFromDB = data[0].PASS;
        const id = data[0].ID;

        //Если вход успешен, то пользователь авторизован
        if(email == emailFromDB & pass == passFromDB){
            isAuthenticated = true;
            currentUserID = id;
            console.log(isAuthenticated + " " + id);
            resp.redirect("user");
        }
    });
});

//Отображение данных пользователя, сохраненных в БД на его странице
app.get("/user", function(req, resp){

    //Проверка, был ли произведен вход
    if(isAuthenticated == true){
        //Достаем данные текущего пользователя из БД
        pool.query("SELECT * FROM USERS WHERE ID=?", currentUserID, function(err, userData){
            if(err) console.log(err);
            //Отображаем данные на страницу
            resp.render("user.hbs", {
                id: currentUserID,
                name: userData[0].NAME,
                number: userData[0].NUMBER
            });
        });
    }
    else resp.sendStatus(401);
});

app.get("/addItem", function(req, resp){
    resp.render("addItem.hbs");
});

//Настраиваем multer
const storageConfig = multer.diskStorage({
    destination: (req, file, cb) =>{
        cb(null, "pic"); //Указываем директорию, куда будет сохранен файл
    },
    filename: (req, file, cb) =>{
        cb(null, file.originalname); //Указываем, что файл будет сохранен с тем же именем и расширением, что и был загружен
    }
});

app.use(express.static(__dirname));
app.use(multer({storage:storageConfig}).single("picture"));

//Добавление товара
app.post("/addItem", urlencodedParser, function(req, resp, next){
    if(!req.body) return resp.sendStatus(422); //Проверка на заполненность формы
    if(!isAuthenticated) return resp.sendStatus(401); //Проверка, была ли произведена аутентификация

    let filedata = req.file; //Загружаем файл
    console.log(filedata);

    //Получаем данные о товаре из формы
    const itemName = req.body.name;
    const itemPrice = req.body.price;
    const itemPic = filedata.filename;// Для упрощенного доступа к загруженному файлу, сохраняем его название в БД

    if(itemName.length < 3) return resp.sendStatus(422);

    //Записываем данные в БД
    pool.query("INSERT INTO ITEMS(NAME, PRICE, PICTURE) VALUES (?, ?, ?)", [itemName, itemPrice, itemPic], function(err, data){
        if(err) return console.log(err);
        resp.redirect("itemList");
    });
});

//Вывод списка всех товаров
app.get("/itemList", function(req, resp){
    
    //Получаем из БД все товары, сохраненные в ней
    pool.query("SELECT * FROM ITEMS", function(err, data){
        if(err) return console.log(err);
        
        //Выводим полученные из БД данные на страницу
        resp.render("itemList.hbs", {
            items: data
        });
    });
});

//Отправка пользователю полной информации о товаре, ID которого указан в ссылке
app.get("/item/:ID",  function(req, resp){

    const id = req.params.ID;// Получаем ID из запроса
    
    //Делаем запрос в таблицу, где храняется данные о товарах, чтобы отправить пользователю данные товара, ID которого был в запросе
    pool.query("SELECT * FROM ITEMS WHERE ID=?", [id], function(err, data){
        if(err) console.log(err);
        console.log(data);
        resp.render("item.hbs", {
            item: data[0]
        });
    });
});

//Редактируем данные о товаре, к которому обращаемся через ID
app.get("/edit/:ID", function(req, resp){
    if(!isAuthenticated) return resp.sendStatus(401); //Проверка, была ли произведена аутентификация
    const id = req.params.ID;//ID товара, указанный в запросе

    //Делаем запрос в таблицу, где храняется данные о товарах, чтобы отправить пользователю данные товара, ID которого был в запросе
    pool.query("SELECT * FROM ITEMS WHERE ID=?", [id], function(err, data) {
        if(err) return console.log(err);
        //Отправляем пользователю данные о товаре
        resp.render("edit.hbs", {
        item: data[0]
    });
  });
});

app.post("/edit", urlencodedParser, function (req, resp) {
         
    if(!req.body) return resp.sendStatus(422);
    if(!isAuthenticated) return resp.sendStatus(401);
    //Получаем данные, отправленные пользователем
    const id = req.body.id;
    const name = req.body.name;
    const price = req.body.price;
  
    //Запрос для обновления данных о товаре, который был отредактирован
    pool.query("UPDATE ITEMS SET NAME=?, PRICE=? WHERE ID=?", [name, price, id], function(err, data) {
        if(err) return console.log(err);
        resp.redirect("/itemList");
    });
});

//Удаляем товар из базы данных
app.post("/delete/:ID", function(req, resp){
    if(!isAuthenticated) return resp.sendStatus(401); //Проверка, была ли произведена аутентификация

    const id = req.params.ID;//Получаем ID товара из запроса
    //Запрос на удаление товара, ID которого получен из запроса
    pool.query("DELETE FROM ITEMS WHERE ID=?", [id], function(err, data) {
        if(err) return console.log(err);
        resp.redirect("/itemList");
    });
});

app.listen(3000, function(){
    console.log("Server is starting");
});
