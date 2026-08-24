import { createApp } from './app.js'

const DEFAULT_PORT = 4000
const configuredPort = Number(process.env.PORT)
const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : DEFAULT_PORT
const host = process.env.HOST?.trim() || '127.0.0.1'

createApp().listen(port, host, () => {
  console.log(`OrdersPaiSoft API listening on http://${host}:${port}`)
})
