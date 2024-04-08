let express = require('express')
let app = express()
let {open} = require('sqlite')
let path = require('path')
let dbpath = path.join(__dirname, 'covid19IndiaPortal.db')
let sqlite3 = require('sqlite3')
app.use(express.json())
let bcrypt = require('bcrypt')
let jwt = require('jsonwebtoken')

let db = null
let initializeDBandServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('server running')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}
initializeDBandServer()

function converterS(obj) {
  return {
    stateId: obj.state_id,
    stateName: obj.state_name,
    population: obj.population,
  }
}

function converterD(obj) {
  return {
    districtId: obj.district_id,
    districtName: obj.district_name,
    stateId: obj.state_id,
    cases: obj.cases,
    cured: obj.cured,
    active: obj.active,
    deaths: obj.deaths,
  }
}

function authenticateToken(request, response, next) {
  let jwtToken
  let bearerToken = request.headers['authorization']
  if (bearerToken !== undefined) {
    jwtToken = bearerToken.split(' ')[1]
  }

  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'train', (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

//API-1
app.post('/login/', async (request, response) => {
  let {username, password} = request.body
  let dbquery = `select * from user where username = '${username}';`
  let dbUser = await db.get(dbquery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    let passwordCheck = await bcrypt.compare(password, dbUser.password)
    if (passwordCheck === true) {
      response.status(200)
      let jwtToken = jwt.sign({username: username}, 'train')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//API-2
app.get('/states/', authenticateToken, async (request, response) => {
  let dbquery = `
  select * 
  from state;`
  let dbresponse = await db.all(dbquery)
  let list_a = []
  for (let i of dbresponse) {
    list_a.push(converterS(i))
  }
  response.send(list_a)
})

//API-3
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  let {stateId} = request.params
  let dbquery = `
  select * 
  from state 
  where state_id = ${stateId};`
  let dbresponse = await db.get(dbquery)
  response.send(converterS(dbresponse))
})

//API-4
app.post('/districts/', authenticateToken, async (request, response) => {
  let {districtName, stateId, cases, cured, active, deaths} = request.body
  let dbquery = `
  insert into district(district_name,state_id,cases,cured,active,deaths)
  values ('${districtName}',${stateId},${cases},${cured},${active},${deaths});`
  let dbresponse = await db.run(dbquery)
  response.send('District Successfully Added')
})

//API-5
app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    let {districtId} = request.params
    let dbquery = `
  select * 
  from district 
  where district_id = ${districtId};`
    let dbresponse = await db.get(dbquery)
    response.send(converterD(dbresponse))
  },
)

//API-6
app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    let {districtId} = request.params
    let dbquery = `
  delete from district
  where district_id = ${districtId};`
    await db.run(dbquery)
    response.send('District Removed')
  },
)

//API-7
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    let {districtId} = request.params
    let {districtName, stateId, cases, cured, active, deaths} = request.body
    let dbquery = `
  update district 
  set
  district_name = '${districtName}',
  state_id = ${stateId},
  cases = ${cases},
  cured = ${cured},
  active = ${active},
  deaths =${deaths}
  where district_id = ${districtId};`
    await db.run(dbquery)
    response.send('District Details Updated')
  },
)

//API-8
app.get(
  '/states/:stateId/stats',
  authenticateToken,
  async (request, response) => {
    let {stateId} = request.params
    let dbquery = `
  select 
  sum(cases) as totalCases,
  sum(cured) as totalCured,
  sum(active) as totalActive,
  sum(deaths) as totalDeaths
  from district 
  where state_id = ${stateId};`
    let dbresponse = await db.all(dbquery)
    response.send(...dbresponse)
  },
)

module.exports = app
