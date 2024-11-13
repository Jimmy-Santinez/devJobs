const mongoose = require('mongoose');
require('./config/db');

const express = require('express');
const { create } = require('express-handlebars'); // Importar con create
const path = require('path');
const router = require('./routes');
const cookieparser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser');
const handlebars = require('handlebars');
const {allowInsecurePrototypeAccess} = require('@handlebars/allow-prototype-access');
// const expressValidator = require('express-validator');
const flash = require('connect-flash');
const createError = require('http-errors');
const passport = require('./config/passport');

require('dotenv').config({path:'variables.env'});

const app = express();

// Habilitar body-parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}))

// validacion de campos con express-validator
// app.use(expressValidator());

// Habilitar handlebars como view
app.engine(
    'handlebars', 
    create({
        handlebars: allowInsecurePrototypeAccess(handlebars),
        defaultLayout: 'layout',
        helpers: require('./helpers/handlebars')
    }).engine
);
app.set('view engine', 'handlebars');

// Archivos estaticos
app.use(express.static(path.join(__dirname, 'public')));

app.use(cookieparser());

app.use(session({
    secret: process.env.SECRETO,
    key: process.env.KEY,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.DATABASE})
}));

// Inicializar passport
app.use(passport.initialize());
app.use(passport.session());

// Alertas y flash messages
app.use(flash());

// Crear nuestro middleware
app.use((req, res, next) => {
    res.locals.mensajes = req.flash();
    next();
})

app.use('/', router());

// 404 pagina no existente
app.use((req, res, next) => {
    next(createError(404, 'No Encontrado'));
});

// Administracion de los errores
app.use((error, req, res) => {
    res.locals.mensaje = error.message;
    const estatus = error.status || 500;
    res.locals.status = estatus;
    res.status(estatus)
    res.render('error');
});

// Dejar que heroku asigne el puerto a nuestra aplicación
const host = '0.0.0.0';
const port = process.env.PORT;
app.listen(port, host, () => {
    console.log('El servidor esta funcionando');
});
