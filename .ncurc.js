module.exports = {
    target: (name) => {
        if (name === '@types/node') return 'minor';
        if (name === 'typescript') return 'patch';
        return 'latest';
    },
};