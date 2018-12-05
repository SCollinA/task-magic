const User = require('./models/User')
const Task = require('./models/Task')

const taskView = require('./views/taskView')
const taskNavView = require('./views/taskNav')
const parentCell = require('./views/parentCell')
const taskCells = require('./views/taskCells')
const loginView = require('./views/loginView')
const registerView = require('./views/registerView')

const bodyParser = require('body-parser')

const express = require('express')
const app = express()
const port = 3001

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


// middleware
function protectRoute(req, res, next) {
    if (req.session.user) {
        next()
    } else {
        res.redirect('/login')
    }
}

// make sure current user is owner of current task
function checkUser(req, res, next) {
    // check if current task is assigned to current user
    Task.getById(req.session.task.id)
    .then(task => {
        // get users for task
        task.getUsers()
        .then(users => {
            console.log(users, task)
            // map to ids of users
            // if current user's id is in tasks users ids
            if (users.map(user => user.id).includes(req.session.user.id)) {
                next()
            } else {
                // else redirect to logged in user's rootTask
                res.redirect('/home')
            }
        })
    })
    .catch(err => res.redirect('/login'))
}

// to prevent users from navigating to task directly
function checkTask(req, res, next) {
    // if they do not have task there is nothing to show them
    if (req.session.task) {
        next()
    } else {
        res.redirect('/login')
    }
}

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
        if (user.matchPassword(password)) {
            req.session.user = user
            res.redirect(`/home`)
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
    .catch(() => res.redirect('/register'))
    .then(user => {
        req.session.user = user
        Task.add(`${userName}'s life`)
        .then(task => {
            task.assignToUser(user.id)
            .then(() => res.redirect(`/home`))
        })
    })
})

app.get('/home', protectRoute, (req, res) => {
    const user = req.session.user
    User.getById(user.id)
    .then(user => {
        user.rootTask()
        .then(rootTask => {
            req.session.task = rootTask
            req.session.previousTasks = []
            res.redirect('/')
        })
    })
})
// define endpoints
// listen for get requests
// main page
app.get('/', protectRoute, checkUser, checkTask, (req, res) => { 
    const taskNav = taskNavView(req.session.task, req.session.previousTasks[req.session.previousTasks.length - 1])
    Task.getById(req.session.task.id)
    .then(task => {
        // need to get active children separately from complete tasks
        task.getChildren()
        .then(children => {
            task.getParents()
            .then(parents => {
                taskCells(children)
                .then(taskCells => {
                    console.log(`Sending task view ${req.session.task.name}`)
                    res.send(taskView(taskNav, taskCells, parentCell(parents)))
                })
            })
        })
    })
})

app.get('/back', protectRoute, (req, res) => {
    req.session.task = req.session.previousTasks.pop()
    console.log(req.session.previousTasks)
    console.log(`Going back to ${req.session.task.name}`)
    res.redirect('/')
})
// doing the task magic
// getting the task
app.get("/:taskID([0-9]+)", protectRoute, (req, res) => {
    Task.getById(req.params.taskID)
    .then(task => {
        req.session.previousTasks.push(req.session.task)
        console.log(req.session.previousTasks)
        req.session.task = task
        console.log(`Task selected: ${task.name}`)
        res.redirect('/')
    })
})

// adds a new task to user's list
app.post("/", protectRoute, (req, res) => {
    // console.log(req.body)
    Task.add(req.body.taskSearch)
    .then(task => {
        task.assignToUser(req.session.user.id)
        .then(() => {
            Task.getById(req.session.task.id)
            .then(parentTask => {
                parentTask.addChild(task)
                .then(() => {
                    res.redirect(`/`)
                })
            })
        })
    })
})

app.get('/complete/:taskID([0-9]+)', protectRoute, (req, res) => {
    Task.getById(req.params.taskID)
    .then(task => {
        task.toggleActive()
        .then(() => res.redirect('/'))
    })
})

app.get('/delete/:taskID([0-9]+)', protectRoute, (req, res) => {
    // delete task here
    Task.deleteById(req.params.taskID)
    .then(() => res.redirect('/'))
})


// REACT methods below >>
// create
app.post('/test-react', (req, res) => {
    User.getById(1)
    .then(user => {
        console.log(req.body.taskName)
        Task.add(req.body.taskName)
        .then(task => user.chooseTask(task.id))
        .then(() => user.getAllTasks())
        .then(tasks => res.json(tasks))
    })
})
// retrieve
app.get('/test-react', (req, res) => {
    User.getById(1)
    .then(user => user.getAllTasks())
    .then(tasks => res.json(tasks))
})
//update
app.post('/test-react-complete', (req, res) => {
    Task.getById(req.body.id)
    .then(task => task.toggleActive())
    .then(() => {
        User.getById(1)
        .then(user => {
            user.getAllTasks()
            .then(tasks => res.json(tasks))
        })
    })
})

app.post('/test-react-name', (req, res) => {
    User.getById(1)
    .then(user => {

    })
})
// delete
app.delete('/test-react-delete', (req, res) => {
    User.getById(1)
    .then(user => {
        Task.getById(req.body.taskID)
        .then(task => user.removeTask(task.id))
        .then(() => user.getAllTasks())
        .then(tasks => res.json(tasks))
    })
})

app.listen(port, () => console.log(`My Task App listening on port ${port}!`))
