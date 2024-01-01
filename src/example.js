export const a = 1;

export function uncovered(v) {
    console.log('uncovered');
    if (v) {
        console.log('branch');
    }
}
