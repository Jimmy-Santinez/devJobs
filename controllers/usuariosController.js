const mongoose = require('mongoose');
const Usuario = mongoose.model('Usuario');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const shortid = require('shortid');

// Subir Imagen
exports.subirImagen = (req, res, next) => {
    upload(req, res, function(error){
        if(error){
            if(error instanceof multer.MulterError){
                if(error.code === 'LIMIT_FILE_SIZE'){
                    req.flash('error', 'El archivo es muy grande: Máximo 100kb');
                } else{
                    req.flash('error', error.message);
                }
            } else{
                req.flash('error', error.message);
            }

            res.redirect('/administracion');
            return;
        } else{
            return next();
        }
    });
}


// Configuraciones de multer
const configuracionMulter = {
    limits: { fileSize: 100000 },
    storage: fileStorage = multer.diskStorage({
        destination: (req, file, callback) => {
            callback(null, __dirname+'../../public/uploads/perfiles');
        },
        filename: (req, file, callback) => {
            const extension = file.mimetype.split('/')[1];
            callback(null, `${shortid.generate()}.${extension}`);
        }
    }),
    fileFilter(req, file, callback) {
        if(file.mimetype === 'application/pdf' || file.mimetype === 'image/jpeg' || file.mimetype === 'image/png'){
            /// el callback se ejecuta como true o false : true cuando la imagen se acepta
            callback(null, true);
        } else{
            callback(new Error('Formato no válido'), false);
        }
    },
}

const upload = multer(configuracionMulter).single('imagen');

exports.formCrearCuenta = (req, res) => {
    res.render('crear-cuenta', {
        nombrePagina: 'Crea tu cuenta en devjobs',
        tagline: 'Comienza a publicar tus vacantes gratis, solo debes crear una cuenta'
    });
}

exports.validarRegistro = async(req, res, next) => {
    
    //sanitizar los campos
    const rules = [
        body('nombre').not().isEmpty().withMessage('El nombre es obligatorio').escape(),
        body('email').isEmail().withMessage('El email es obligatorio').normalizeEmail(),
        body('password').not().isEmpty().withMessage('El password es obligatorio').escape(),
        body('confirmar').not().isEmpty().withMessage('Confirmar password es obligatorio').escape(),
        body('confirmar').equals(req.body.password).withMessage('Los passwords no son iguales')
    ];
    
    await Promise.all(rules.map(validation => validation.run(req)));
    const errores = validationResult(req);
    

    //Validamos que el arreglo de errores contenga un error
    //si es así, alertamos al usuario y detenemos el proceso
    if (!errores.isEmpty()) {
        req.flash('error', errores.array().map(error => error.msg));
        res.render('crear-cuenta', {
            nombrePagina: 'Crea una cuenta en Devjobs',
            tagline: 'Comienza a publicar tus vacantes gratis, solo debes crear una cuenta',
            mensajes: req.flash()
        })
        return;
    }

    //Si todo sale bien
    next();
}

exports.crearUsuario = async(req, res, next) =>{
    // crear el usuario
    const usuario = new Usuario(req.body);

    try {
        await usuario.save();
        res.redirect('/iniciar-sesion');
    } catch (error) {
        req.flash('error', error);
        res.redirect('/crear-cuenta');
    }
}

// Formulario para iniciar sesión
exports.formIniciarSesion = (req, res) => {
    res.render('iniciar-sesion', {
        nombrePagina: 'Iniciar Sesión devJobs',
    });
}

// Formulario para editar el perfil
exports.formEditarPerfil = (req, res) => {
    res.render('editar-perfil', {
        nombrePagina: 'Edita tu perfil en devJobs',
        usuario: req.user,
        cerrarSesion: true,
        nombre: req.user.nombre,
        imagen: req.user.imagen,
    })
}

// Guardar cambios al editar el perfil
exports.editarPerfil = async(req, res) => {
    const usuario = await Usuario.findById(req.user._id);

    usuario.nombre = req.body.nombre;
    usuario.email = req.body.email;
    if(req.body.password){
        usuario.password = req.body.password;
    }

    if(req.file){
        usuario.imagen = req.file.filename;
    }

    await usuario.save();

    req.flash('correcto', 'Cambios guardados correctamente!')

    // Redireccionar
    res.redirect('/administracion');
}

// Sanitizar y validar el formulario de editar perfiles
exports.validarPerfil = async(req, res, next) => {
    //sanitizar los campos
    const rules = [
        body('nombre').not().isEmpty().withMessage('El nombre es obligatorio').escape(),
        body('email').isEmail().withMessage('El email es obligatorio').normalizeEmail()
    ];

    await Promise.all(rules.map(validation => validation.run(req)));
    const errors = validationResult(req);

    //si hay errores
    if (!errors.isEmpty()) {
        req.flash('error', errors.array().map(error => error.msg));

        res.render('editar-perfil', {
            nombrePagina: 'Edita tu perfil en DevJobs',
            usuario: req.user.toObject(),
            cerrarSesion: true,
            nombre: req.user.nombre,
            mensajes: req.flash()
        })
        return;
    }

    //si toda la validacion es correcta
    next();
}

