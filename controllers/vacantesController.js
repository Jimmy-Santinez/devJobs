const mongoose = require('mongoose');
const Vacante = mongoose.model('Vacante');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const shortid = require('shortid');
const { cerrarSesion } = require('./authController');

// Muestra la pagina donde se ve el formulario para agregar una nueva vacante
exports.formularioNuevaVacante = (req, res) => {
    res.render('nueva-vacante', {
        nombrePagina: 'Nueva Vacante',
        tagline: 'Llena el formulario y publica tu vacante',
        cerrarSesion: true,
        nombre: req.user.nombre,
        imagen: req.user.imagen,
    });
};

// Agrega una vacante
exports.agregarVacante =  async(req, res) => {
    const vacante = new Vacante(req.body);

    // Usuario autor de la vacante
    vacante.autor = req.user._id;

    // Crear arreglo de habilidades (skills)
    vacante.skills = req.body.skills.split(',');

    //Almacenarlo en la base de datos
    const nuevaVacante = await vacante.save();

    // //Redireccionar
    res.redirect(`/vacantes/${nuevaVacante.url}`);
}

// Muestra una vacante
exports.mostrarVacante = async(req, res, next) => {
    const vacante = await Vacante.findOne({url: req.params.url}).populate('autor');
    console.log(vacante);

    // si no hay resultado
    if(!vacante) return next();

    res.render('vacante', {
        vacante,
        nombrePagina: vacante.titulo,
        barra: true
    });
}


// Muestra la pagina donde se ve el form para editar una vacante
exports.formEditarVacante = async(req, res, next) => {
    const vacante = await Vacante.findOne({url: req.params.url});

    if(!vacante) return next();

    res.render('editar-vacante', {
        vacante,
        nombrePagina: `Editar - ${vacante.titulo}`,
        cerrarSesion: true,
        nombre: req.user.nombre,
        imagen: req.user.imagen,
    });
}


// Edita la vacante
exports.editarVacante = async(req, res) => {
    const vacanteActualizada = req.body;
    vacanteActualizada.skills = req.body.skills.split(',');

    const vacante = await Vacante.findOneAndUpdate({url: req.params.url}, 
        vacanteActualizada,{
            new: true,
            runValidators: true,
        }
    );

    res.redirect(`/vacantes/${vacante.url}`);
}

// Validar y sanitizar los campos de las nuevas vacantes
exports.validarVacante =  async(req, res, next) => {
    // Sanitiza
    const rules = [
        body("titulo").not().isEmpty().withMessage("Agrega un titulo a la vacante").escape(),
        body("empresa").not().isEmpty().withMessage("Agrega una empresa").escape(),
        body("ubicacion").not().isEmpty().withMessage("Agrega una ubicación").escape(),
        body("contrato").not().isEmpty().withMessage("Selecciona el tipo de contrato").escape(),
        body("skills").not().isEmpty().withMessage("Agrega al menos una habilidad").escape(),
    ];
    await Promise.all(rules.map((validation) => validation.run(req)));
    const errors = validationResult(req);

    // Valida
    if(!errors.isEmpty()){
        // Recargar la vista con los errores
        req.flash('error', errors.array().map(error => error.msg));

        res.render('nueva-vacante', {
            nombrePagina: 'Nueva Vacante',
            tagline: 'Llena el formulario y publica tu vacante',
            cerrarSesion: true,
            nombre: req.user.nombre,
            mensajes: req.flash(),
        });
        return;
    }

    next(); // Pasamos al siguiente middleware
}

// Eliminar vacante
exports.eliminarVacante = async(req, res) => {
    const { id } = req.params;

    try {
        const vacante = await Vacante.findById(id);

        if(verificarAutor(vacante, req.user)){
            //Si es el usuario que creó la vacante, entonces eliminar la vacante
            await vacante.deleteOne();
            res.status(200).send('Vacante eliminada correctamente');

        } else{
            //No puede eliminar la vacante porque no es el usuario que la creó
            res.status(403).send('Vacante eliminada correctamente')
        }
    } catch (error) {
        console.error(error);
        return res.status(500).send('Error interno del servidor');
    }
}

const verificarAutor = (vacante = {}, usuario = {}) => {
    if(!vacante.autor.equals(usuario._id)){
        return false;
    } else{
        return true;
    }
}


// Subir archivos en PDF
exports.subirCV = (req, res, next) => {
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

            res.redirect('back');
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
            callback(null, __dirname+'../../public/uploads/cv');
        },
        filename: (req, file, callback) => {
            const extension = file.mimetype.split('/')[1];
            callback(null, `${shortid.generate()}.${extension}`);
        }
    }),
    fileFilter(req, file, callback) {
        if(file.mimetype === 'application/pdf'){
            /// el callback se ejecuta como true o false : true cuando la imagen se acepta
            callback(null, true);
        } else{
            callback(new Error('Formato no válido'), false);
        }
    },
}

const upload = multer(configuracionMulter).single('cv');

// Almacenar los candidatos en la BD
exports.contactar = async(req, res, next) => {
    const vacante = await Vacante.findOne({url: req.params.url});

    // sino existe la vacante
    if(!vacante) return next();

    // todo bien, construir el nuevo objeto
    if(!req.file){
        req.flash('error', 'Es obligatorio subir su CV');
        res.redirect('back');
        return;
    }
    
    const nuevoCandidato = {
        nombre: req.body.nombre,
        email: req.body.email,
        cv: req.file.filename,
    };
    
    // almacenar la vacante
    vacante.candidatos.push(nuevoCandidato);
    await vacante.save();

    // mensaje flash y redireccion
    req.flash('correcto', 'Se envió tu curriculum correctamente');
    res.redirect('/');
}

// Mostrar los candidatos de la vacante
exports.mostrarCandidatos = async(req, res, next) => {
    const vacante = await Vacante.findById(req.params.id);

    if(vacante.autor != req.user._id.toString()){
        return next();
    }

    if(!vacante) return next();

    res.render('candidatos', {
        nombrePagina: `Candidatos Vacante - ${vacante.titulo}`,
        cerrarSesion: true,
        nombre: req.user.nombre,
        imagen: req.user.imagen,
        candidatos: vacante.candidatos
    })
}

// Mostrar la pagina de buscar
exports.formBuscarVacantes = (req, res) => {
    res.render('home', {
        nombrePagina: 'Buscar vacantes',
        barra: true
    });
}

// Buscador de vacantes
exports.buscarVacantes = async(req, res) => {
    const vacantes = await Vacante.find({
        $text: {
            $search: req.body.q
        }
    });
    console.log(vacantes);

    // Mostrar las vacantes
    res.render('home', {
        nombrePagina: `Resultados para la busqueda: ${req.body.q}`,
        barra: true,
        vacantes
    });
}