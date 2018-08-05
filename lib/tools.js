function getDate(d) {
    d = d || new Date();

    return d.getFullYear() + '_' +
        ('0' + (d.getMonth() + 1)).slice(-2) + '_' +
        ('0' + d.getDate()).slice(-2) + '-' +
        ('0' + d.getHours()).slice(-2) + '_' +
        ('0' + d.getMinutes()).slice(-2) + '_' +
        ('0' + d.getSeconds()).slice(-2);
}


module.exports = {
    getDate
};