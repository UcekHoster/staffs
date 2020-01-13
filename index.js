const dotenv = require('dotenv');
const express = require('express');
const app = express();
const cors = require('cors');
const mongodb = require('mongodb');
const FileStream = require('fs');
const mongoClient = mongodb.MongoClient;
const mongoose = require('mongoose');
const bodyParser = require('body-parser')
const ejs = require('ejs');
const path = require('path');
const pdf = require('html-pdf');
const Binary = mongodb.Binary;
dotenv.config();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.static(__dirname + '/public'));
app.use(cors());

mongoose.connect(process.env.DB_SECRET_KEY, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    useCreateIndex: true
}, () => {
    console.log('Connected to Mongo');
});
app.get('/error', async (req, res) => {
    res.render('error', {
        header: "Internal Server Error"
    })
});
app.get('/', (req, res) => {
    const d1 = new Date();
    const year0 = d1.getFullYear();
    const d = new Date(year0, 4, 25);
    const year4 = d.getFullYear() - 3;
    const year3 = d.getFullYear() - 2;
    const year2 = d.getFullYear() - 1;
    res.render('home', {
        year2: year2,
        year3: year3,
        year4: year4,
        header: 'Staff Panel'
    });
})
app.get('/:year', async (req, res) => {
    const year = parseInt(req.params.year);
    await mongoClient.connect(process.env.DB_SECRET_KEY, {
            useUnifiedTopology: true,
            useNewUrlParser: true
        },
        async (err, client) => {
            let db = client.db('mainStore')
            let collection = db.collection('users')
            await collection.find({
                yearofJoining: year
            }).toArray((err, data) => {
                if (err) {
                    res.render('error', {
                        header: 'Error - Staff Panel'
                    })
                } else {
                    res.render('holder', {
                        data: data,
                        header: `${year} - Staff Panel`
                    })
                }
            })
        })
});

app.post('/reader/:data', async (req, res) => {
    const data = req.params.data;
    await mongoClient.connect(process.env.DB_SECRET_KEY, {
            useUnifiedTopology: true,
            useNewUrlParser: true
        },
        async (err, client) => {
            let db = client.db('mainStore')
            let collection = db.collection('users')
            await collection.findOne({
                nad: data
            }, (err, data) => {
                if (err) {
                    res.redirect('error', )
                } else {
                    res.render('student', {
                        profile: data,
                        header: data.name
                    })
                }
            })
        })
});
app.post('/authenticate/yes/:id', async (req, res) => {
    const id = req.params.id
    await mongoClient.connect(process.env.DB_SECRET_KEY, {
            useUnifiedTopology: true,
            useNewUrlParser: true
        },
        async (err, client) => {
            let db = client.db('mainStore')
            let collection = db.collection('users')
            await collection.updateOne({
                nad: id
            }, {
                $set: {
                    autherized: 'Yes'
                }
            }, {
                upsert: true
            })
            let dbs = client.db('mainStore')
            let collections = dbs.collection('storage')
            await collections.updateOne({
                nad: id
            }, {
                $set: {
                    autherized: 'Yes'
                }
            }, {
                upsert: true
            })
            await collection.findOne({
                nad: id
            }, (err, profile) => {
                if (err) {
                    res.redirect('/error');
                } else {
                    const userData = profile;
                    ejs.renderFile(path.join(__dirname, '/views/', "pdfTemplate.ejs"), {
                        profile: userData
                    }, (err, data) => {
                        if (err) {
                            res.send(err)
                        } else {
                            let options = {
                                "format": "A4",
                                "orientation": "portrait",
                                "border": {
                                    "left": "1cm",
                                    "right": "1cm",
                                    "top": "1cm",
                                    "bottom": "1cm"
                                },
                                "header": {
                                    "height": "5mm",
                                    "contents": {
                                        first: '<div style="text-align: center"><h2>UNIVERSITY COLLEGE OF ENGINEERING - KANCHEEPURAM</h4><h3>DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING</h5><hr></div>'
                                    }
                                },
                                "footer": {
                                    "height": "20mm",
                                    "contents": '<hr><h1><b>AUTHORIZED COPY</b></h1>'
                                }
                            };

                            pdf.create(data, options).toBuffer(function (err, data) {
                                if (err) {
                                    res.redirect('/error');
                                } else {
                                    let file = {
                                        nad: profile.nad,
                                        username: profile.name,
                                        yearofJoining: profile.yearofJoining,
                                        autherized: profile.autherized,
                                        file: Binary(data)
                                    }
                                    insertFile(file, res);
                                    async function insertFile(file, res) {
                                        await mongoClient.connect(process.env.DB_SECRET_KEY, {
                                                useUnifiedTopology: true,
                                                useNewUrlParser: true,
                                                useCreateIndex: true
                                            },
                                            async (err, client) => {
                                                let db = client.db('mainStore')
                                                let collection = db.collection('storage')
                                                collection.findOne({
                                                    nad: file.nad
                                                }, async (err, data) => {
                                                    if (err) {
                                                        collection.insertOne(file);
                                                    } else {

                                                        try {
                                                            await collection.updateMany({
                                                                nad: file.nad
                                                            }, {
                                                                $set: {
                                                                    "name": file.username,
                                                                    "file": file.file,
                                                                    "yearofJoining": file.yearofJoining,
                                                                    "autherized": file.autherized
                                                                }
                                                            }, {
                                                                upsert: true
                                                            });
                                                        } catch (err) {
                                                            res.redirect('/error');
                                                        }
                                                    }
                                                    client.close(true)
                                                });
                                            });
                                    }
                                }
                            });
                        }
                    });
                }
            })

            let dby = client.db('mainStore')
            let collectiony = dby.collection('storage')
            await collectiony.findOne({
                nad: id
            }, (err, years) => {
                const year = years.yearofJoining
                res.redirect(`/${year}`)
            })
        }
    )
})
app.post('/authenticate/no/:id', async (req, res) => {
    const id = req.params.id
    await mongoClient.connect(process.env.DB_SECRET_KEY, {
            useUnifiedTopology: true,
            useNewUrlParser: true
        },
        async (err, client) => {
            let db = client.db('mainStore')
            let collection = db.collection('users')
            await collection.updateOne({
                nad: id
            }, {
                $set: {
                    autherized: 'No'
                }
            }, {
                upsert: true
            })
            let dbs = client.db('mainStore')
            let collections = dbs.collection('storage')
            await collections.updateOne({
                nad: id
            }, {
                $set: {
                    autherized: 'No'
                }
            }, {
                upsert: true
            })
            await collection.findOne({
                nad: id
            }, (err, profile) => {
                if (err) {
                    res.redirect('/error');
                } else {
                    const userData = profile;
                    ejs.renderFile(path.join(__dirname, '/views/', "pdfTemplate.ejs"), {
                        profile: userData
                    }, (err, data) => {
                        if (err) {
                            res.send(err)
                        } else {
                            let options = {
                                "format": "A4",
                                "orientation": "portrait",
                                "border": {
                                    "left": "1cm",
                                    "right": "1cm",
                                    "top": "1cm",
                                    "bottom": "1cm"
                                },
                                "header": {
                                    "height": "5mm",
                                    "contents": {
                                        first: '<div style="text-align: center"><h2>UNIVERSITY COLLEGE OF ENGINEERING - KANCHEEPURAM</h4><h3>DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING</h5><hr></div>'
                                    }
                                },
                                "footer": {
                                    "height": "20mm",
                                    "contents": '<hr><h1><b>UNAUTHORIZED COPY</b></h1>'
                                }
                            };

                            pdf.create(data, options).toBuffer(function (err, data) {
                                if (err) {
                                    res.redirect('/error');
                                } else {
                                    let file = {
                                        nad: profile.nad,
                                        username: profile.name,
                                        yearofJoining: profile.yearofJoining,
                                        autherized: profile.autherized,
                                        file: Binary(data)
                                    }
                                    insertFile(file, res);
                                    async function insertFile(file, res) {
                                        await mongoClient.connect(process.env.DB_SECRET_KEY, {
                                                useUnifiedTopology: true,
                                                useNewUrlParser: true,
                                                useCreateIndex: true
                                            },
                                            async (err, client) => {
                                                let db = client.db('mainStore')
                                                let collection = db.collection('storage')
                                                collection.findOne({
                                                    nad: file.nad
                                                }, async (err, data) => {
                                                    if (err) {
                                                        collection.insertOne(file);
                                                    } else {

                                                        try {
                                                            await collection.updateMany({
                                                                nad: file.nad
                                                            }, {
                                                                $set: {
                                                                    "name": file.username,
                                                                    "file": file.file,
                                                                    "yearofJoining": file.yearofJoining,
                                                                    "autherized": file.autherized
                                                                }
                                                            }, {
                                                                upsert: true
                                                            });
                                                        } catch (err) {
                                                            res.redirect('/error');
                                                        }
                                                    }
                                                    client.close(true)
                                                });
                                            });
                                    }
                                }
                            });
                        }
                    });
                }
            })

            let dby = client.db('mainStore')
            let collectiony = dby.collection('storage')
            await collectiony.findOne({
                nad: id
            }, (err, years) => {
                const year = years.yearofJoining
                res.redirect(`/${year}`)
            })
        }
    )
})

let port = process.env.PORT;
if (port == null || port == "") {
    port = 9000;
}
app.listen(port, () => {
    console.log(`Server started at ${port}`)
});