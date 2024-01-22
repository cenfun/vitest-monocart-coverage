
export function sum(a, b) {

    [a, b].forEach((v) => {

    });

    if (a === 'random') {
        console.log(a);
    }

    return a + b;
}

export function uncoveredFunction(a) {
    console.log('uncovered function');

    if (a) {
        console.log(a);
    }
}
