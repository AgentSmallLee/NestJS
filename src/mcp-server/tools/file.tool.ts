export async function handleFileOperation(args: { operation: string, filePath: string }) {
    const { operation, filePath } = args
    if (operation === 'read') {
        return 'read file with path ' + filePath
    } else if (operation === 'write') {
       return 'write file with path ' + filePath
    } else {
        return 'unsupported operation'
    }
}