//Configurando o servidor
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}
const express = require("express")
const server = express()
const bcrypt = require("bcrypt")
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')


//Variaveis
users = []
userC = 0;
senhaAdmin = ''
achou = []
achouC = []

server.use((req, res, next) => { //Cria um middleware onde todas as requests passam por ele 
    if (req.headers["x-forwarded-proto"] == "http") //Checa se o protocolo informado nos headers é HTTP 
        res.redirect(`https://${req.headers.host}${req.url}`); //Redireciona pra HTTPS 
    else //Se a requisição já é HTTPS 
        next(); //Não precisa redirecionar, passa para os próximos middlewares que servirão com o conteúdo desejado 
});

const initializePassport = require('./passport-config')
initializePassport(
    passport,
    email => users.find(user => user.email === email),
    id => users.find(user => user.id === id)
)


//Configurar conexão BD
const Pool = require('pg').Pool
const db = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME
})
//Configurando template engine
const nunjucks = require("nunjucks")
nunjucks.configure("./", {
    express: server,
    noCache: true,
})

//Apresentar arquivos estaticos
server.use(express.static('public'))

server.set('view-engine', 'ejs')
server.use(express.urlencoded({ extended: false }))

///
server.use(flash())
server.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}))
server.use(passport.initialize())
server.use(passport.session())
server.use(methodOverride('_method'))

//Apresentação da página
server.get('/', checkAuthenticated, (req, res) => {
    res.render('index.html', { name: req.user.name })
})
server.get('/login', checkNotAuthenticated, (req, res) => {
    db.query("SELECT * FROM users", function (err, result) {
        if (err) return res.render("Erro no banco de dados!")
        users = result.rows
    })
    res.render('login.html')
})
server.post('/login', checkNotAuthenticated, passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
}))

server.post("/", checkAuthenticated, function (req, res) {
    const militar = req.body.militar
    const oficial = req.body.oficial
    const patente = req.body.patente
    const data = req.body.data
    const status = req.body.status
    const query = `INSERT INTO militares ("militar", "oficial", "patente", "data", "status") VALUES ($1, $2, $3, $4, $5)`
    const values = [militar, oficial, patente, data, status]
    db.query(query, values, function (err) {
        if (err) {
            const query2 = `UPDATE militares SET militar = $1, oficial = $2, patente = $3, data = $4, status = $5 WHERE militar = $6`
            values2 = [militar, oficial, patente, data, status, militar]
            db.query(query2, values2, function (err) {
                if (err) return res.send("Erro no banco de dados.")
            })
        }
        return res.redirect("/")
    })
})

server.get('/admin/register', (req, res) => {
    db.query("SELECT * FROM users", function (err, result) {
        if (err) return res.render("Erro no banco de dados!")
        users = result.rows
        userC = result.rowCount
    })
    res.render('register.html')
})

server.post('/admin/register', async (req, res) => {
    nameIgual = 0
    emailIgual = 0
    for (var x = 0; x < userC; x++) {
        if (users[x].name == req.body.name) nameIgual = 1
        if (users[x].email == req.body.email) emailIgual = 1
    }
    try {
        if (nameIgual) {
            res.render('register.html', { message: 'Este nome de usuário já está vinculado a uma conta' })
        } else if (emailIgual) {
            res.render('register.html', { message: 'Este email já está vinculado a uma conta' })
        } else if (req.body.adminpass != senhaAdmin) {
            res.render('register.html', { message: 'Senha do administrador incorreta' })
        } else {
            const hashedPassword = await bcrypt.hash(req.body.password, 10)
            const name = req.body.name
            const email = req.body.email
            const query = `INSERT INTO users ("name", "email", "password") VALUES ($1, $2, $3)`
            const values = [name, email, hashedPassword]
            db.query(query, values, function (err) {
                if (err) return res.send("Erro no banco de dados")
            })
            res.redirect('/admin')
        }
    } catch {
        res.redirect('/admin/register')
    }
})
server.get('/update', checkAuthenticated, (req, res) => {
    res.render('update.html', { name: req.user.name, email: req.user.email })
})
server.post('/update', checkAuthenticated, async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10)
        const name = req.body.name
        const email = req.body.email
        const query = `UPDATE users SET email = $1, password = $2 WHERE name = $3`
        const values = [email, hashedPassword, name]
        db.query(query, values, function (err) {
            if (err) return res.send("Erro no banco de dados")
        })
        res.redirect('/')

    } catch {
        res.redirect('/update')
    }
})
server.post('/admin/delete', async (req, res) => {
    try {
        if (req.body.adminpass != senhaAdmin) {
            res.render('delete.html', { message: 'Senha do administrador incorreta' })
        } else {
            const name = req.body.name
            const query = `DELETE FROM users WHERE name = $1`
            const values = [name]
            db.query(query, values, function (err) {
                if (err) return res.send("Erro no banco de dados")
            })
            res.redirect('/admin')
        }
    } catch {
        res.redirect('/admin/delete')
    }
})
server.get('/admin', (req, res) => {
    res.render('admin.html')
})
server.get('/admin/delete', (req, res) => {
    res.render('delete.html')
})
server.delete('/logout', (req, res) => {
    req.logOut()
    res.redirect('/login')
})
server.get('/busca', (req, res) => {
    db.query("SELECT * FROM militares", function (err, result) {
        if (err) return res.render("Erro no banco de dados!")
        achou = result.rows
        achouC = result.rowCount
    })
    res.render('busca1.html')
})
server.post('/busca', (req, res) => {
    militarBusca = req.body.militar
    militar = ''
    oficial = ''
    patente = ''
    data = ''
    status = ''
    cor = 'green'
    for (var x = 0; x < achouC; x++) {
        if (ciEquals(achou[x].militar, militarBusca)) {
            militar = achou[x].militar
            oficial = achou[x].oficial
            patente = achou[x].patente
            data = achou[x].data
            status = achou[x].status
            cor = 'green'
            if (achou[x].status == 'Ativo') cor = 'green'
            if (achou[x].status == 'Demitido') cor = 'red'
            if (achou[x].status == 'Reformado') cor = 'orange'
        }
    }
    if (militar == ''){
        res.redirect('/busca')
    } else {
        res.render('busca2.html', {militar: militar, oficial: oficial, patente: patente, data: data, status: status, cor: cor})
    }
})
//auth
function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next()
    }

    res.redirect('/login')
}

function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect('/')
    }
    next()
}
function ciEquals(a, b) {
    return typeof a === 'string' && typeof b === 'string'
        ? a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0
        : a === b;
}
//Ligando servidor e permitindo acesso
server.listen(3000, function () {
    console.log("Servidor ligado.")
})