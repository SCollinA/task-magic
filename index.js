const bodyParser = require('body-parser')

const express = require('express')
const app = express()
const port = 3000

const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const db = require('./models/db');
app.use(session({
    store: new pgSession({
        pgPromise: db
    }),
    secret: 'random123',
    saveUninitialized: false
}));

app.use(express.static('public'))

app.use(bodyParser.urlencoded({extended: false}))

app.use(bodyParser.json())

const User = require('./models/User')
const Task = require('./models/Task')

const taskViewTemplate = require('./views/taskView.js')
const taskView = taskViewTemplate.taskView
const headerView = taskViewTemplate.header
const createTaskCells = taskViewTemplate.taskCells
const loginView = require('./views/loginView')
const registerView = require('./views/registerView')

let currentUser
let currentTask
let previousTasks = []

app.get('/', (req, res) => res.redirect('/login'))

app.get('/login', (req, res) => {
    res.send(loginView())
})
app.post('/login', (req, res) => {
    // get values from form
    const userName = req.body.username.toLowerCase()
    const password = req.body.password
    // find user
    User.getByName(userName)
    .then(user => {
        debugger
        if (user.matchPassword(password)) {
            req.session.user = user
            res.redirect(`/user/${user.id}`)
        } else {
            res.redirect('/login');
        }
    })
})
app.post('/logout', (req, res) => {
    req.session.destroy()

    res.redirect('/login')
})

app.get('/register', (req, res) => {
    res.send(registerView())
})
app.post('/register', (req, res) => {
    // get values
    const userName = req.body.username.toLowerCase()
    const password = req.body.password
    // create user
    User.add(userName, password)
    .then(user => {
        req.session.user = user
        Task.add(`${userName}'s life`)
        .then(task => {
            task.assignToUser(user.id)
            .then(() => res.redirect(`/user/${user.id}`))
        })
    })
})
// define endpoints
// listen for get requests
app.get('/user/:userID([0-9]+)', (req, res) => {
    User.getById(req.params.userID)
    // .then(console.log)
    .then(user => {
        currentUser = user
        user.rootTask().then(task => {
            currentTask = task
            res.redirect(`/task/${task.id}`)
            // const header = headerView(task, previousTasks[0])
            // res.send(taskView(header, children))
        })
    })
})


// doing the task managing sutff
app.get("/task/:taskID([0-9]+)", (req, res) => {
    Task.getById(req.params.taskID)
    .then(task => {
        task.getUsers()
        .then(users => users.includes(req.session.user))
        .then(console.log)
        // task.getChildren()
        // .then(children => {
        //     if (!currentTask) {
        //         currentTask = task
        //     }
        //     // if we are not at a previous task already
        //     if (currentTask.id != task.id && !previousTasks.map(prevTask => prevTask.id).includes(task.id)) {
        //         previousTasks.unshift(currentTask)
        //         console.log(previousTasks)
        //     } else if (previousTasks.length > 0 && task.id == previousTasks[0].id) {
        //         previousTasks.shift()
        //         console.log(previousTasks)
        //     }
        //     currentTask = task
        //     console.log(currentTask)
        //     const header = headerView(task, previousTasks[0])
        //     createTaskCells(children)
        //     .then(taskCells => res.send(taskView(header, taskCells)))
        // })
    })
})

app.post("/task/:parentTaskID([0-9]+)", (req, res) => {
    // console.log(req.body)
    if (currentUser) { // if a user is logged in
        Task.add(req.body.taskSearch)
        .then(task => {
            task.assignToUser(currentUser.id)
            .then(() => {
                currentTask.addChild(task)
                // task.addParent(currentTask)
                .then(() => {
                    res.redirect(`/task/${currentTask.id}`)
                })
            })
        })
    } else {
        res.send('Not logged in...')
    }
})

app.listen(port, () => console.log(`My Task App listening on port ${port}!`))
