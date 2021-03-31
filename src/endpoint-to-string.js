export default endpoint => {
  endpoint = {
    database: 'project',
    host: 'localhost',
    password: '',
    port: 5984,
    user: '',
    ...endpoint,
  }

  const credentials = endpoint.user
    ? `${endpoint.user}${endpoint.password ? `:${endpoint.password}` : ''}@`
    : ''

  return `http://${credentials}${endpoint.host}${
    endpoint.port === 80 ? '' : `:${endpoint.port}`
  }/${endpoint.database}`
}
