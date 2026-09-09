import { createApp } from './app.js'

const DEFAULT_PORT = 4000
const configuredPort = Number(process.env.PORT)
const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : DEFAULT_PORT
const host = process.env.HOST?.trim() || '0.0.0.0'

createApp().listen(port, host, () => {
  console.log(`OMP API listening on http://${host}:${port}`)
})
