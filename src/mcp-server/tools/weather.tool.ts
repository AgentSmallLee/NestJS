export async function handleWeatherQuery(args: { location: string }) {
    const { location } = args
    return 'query weather for ' + location
}