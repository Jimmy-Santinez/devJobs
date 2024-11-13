// Arcivo de conexion a la Base de datos de mongo

const mongoose = require('mongoose');
require('dotenv').config({path: 'variables.env'});

//mongoose.connect(process.env.DATABASE, {useNewUrlParser:true});
mongoose.connect(process.env.DATABASE);

mongoose.connection.on('error', (error) => {
    console.log(error);
});

// Importar Los Modelos
require('../models/Vacantes');
require('../models/Usuarios');