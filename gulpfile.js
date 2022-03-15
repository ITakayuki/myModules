const encode = "Shift_JIS"
const encodeOption = {
    eolc: "CRLF",
    encoding: "Shift_JIS"
}
const glob = require("glob")
const fs = require("fs-extra");
const gulp = require('gulp'); //gulp
const rename = require('gulp-rename'); //名前変更
const sass = require('gulp-sass'); //sassコンパイル
const postcss = require('gulp-postcss'); //autoprefixerを使うのに必要
const autoprefixer = require('autoprefixer'); //prefixをつける
const ejs = require('gulp-ejs'); //ejsコンパイル
const htmlbeautify = require('gulp-html-beautify');
const imagemin = require('gulp-imagemin'); //画像圧縮
const browserSync = require('browser-sync').create(); //ブラウザシンク
const tinyping = require('gulp-tinypng-compress')
const watch = require('gulp-watch')
const plumber = require("gulp-plumber");
const browserify = require('browserify');
const babelify = require('babelify');
const source = require('vinyl-source-stream');
const lineEncoding = require("gulp-line-ending-corrector")
const textEncoding = require("gulp-convert-encoding")
const streamify = require('gulp-streamify');
const header = require("gulp-header");
const defaultDist = 'dist/'
const defaultHtdocs = "htdocs/"
let debug = false;
const paths = {
    scss: {
        src: 'src/assets/scss/pages/**/*.scss',
        dist: `${defaultDist}/assets/css/`,
        htdocs: `${defaultHtdocs}/assets/css/`
    },
    js: {
        src: 'src/assets/js/pages',
        dist: `${defaultDist}/assets/js/`,
        htdocs: `${defaultHtdocs}/assets/js/`,
    },
    ejs: {
        src: 'src/pages/**/*.ejs',
        dist: `${defaultDist}/`,
        htdocs: `${defaultHtdocs}/`
    },
    component: {
        src: 'src/components/**/*.ejs'
    },
    image: {
        src: 'src/assets/img/**/*.{jpeg,jpg,png,svg}',
        dist: `${defaultDist}/assets/img/`,
        htdocs: `${defaultHtdocs}/assets/img/`
    },
    static: {
        src: 'static/**',
        dist: `${defaultDist}/`,
        htdocs: `${defaultHtdocs}/`
    }
}

const scssCompile = () => {
    gulp.src(paths.scss.src, {since: gulp.lastRun(scssCompile)})
        .pipe(plumber())
        .pipe(sass())
        .pipe(postcss([autoprefixer({
            grid: 'autoplace'
        })]))
        .on("'error", (error) => {
            console.log(error.message)
        })
        .on("end", () => {
            console.log("【Complete】scss")
        })
        .pipe(gulp.dest(paths.scss.dist))
}
const scssProduction = () => {
    gulp.src(paths.scss.src, {since: gulp.lastRun(scssCompile)})
        .pipe(plumber())
        .pipe(sass())
        .pipe(postcss([autoprefixer({
            grid: 'autoplace'
        })]))
        .on("'error", (error) => {
            console.log(error.message)
        })
        .on("end", () => {
            console.log("【Complete】scss")
        })
        .pipe(header('@charset "shift_jis";\n\n'))
        .pipe(streamify(lineEncoding(encodeOption)))
        .pipe(gulp.dest(paths.scss.htdocs))
}


const getDirPath = (str) => {
    const array = str.split("/");
    if (array.length === 1) {
        return null;
    }
    let dir = "";
    for (let i = 0; i<array.length -1; i++) {
        dir = dir + array[i] + "/"
    }
    return dir;
}
const jsCompile = () => {
    glob(`${paths.js.src}/**/*.ts`, (err, files) => {
        for (const filePath of files) {
            const dirPath = filePath.replace("src/assets/js/pages/", "");
            const outDir = getDirPath(dirPath);
            const filePathArray = dirPath.split("/");
            const fileName = filePathArray[filePathArray.length-1];
            browserify(filePath, {debug: true})
              .transform(babelify)
                .plugin('tsify')
                .bundle()
                .on("error", (error) => {
                    console.log(error.message)
                })
                .on("end", () => {
                    console.log("【Complete】js")
                })
                .pipe(plumber())
                .pipe(source(fileName.replace(".ts", ".js")))
                .pipe(gulp.dest(`${paths.js.dist}${outDir ? outDir : ""}`))
        }
    })
}

const jsProduction = () => {
    glob(`${paths.js.src}/**/*.js`, (err, files) => {
        for (const filePath of files) {
            const dirPath = filePath.replace("src/assets/js/pages/", "");
            const outDir = getDirPath(dirPath);
            const filePathArray = dirPath.split("/");
            const fileName = filePathArray[filePathArray.length-1];
            browserify(filePath, {debug: false})
                .plugin('tsify')
                .bundle()
                .on("error", (error) => {
                    console.log(error.message)
                })
                .on("end", () => {
                    console.log("【Complete】js")
                })
                .pipe(plumber())
                .pipe(source(fileName))
                .pipe(gulp.dest(`${paths.js.htdocs}${outDir ? outDir : ""}`))
        }
    })
}

const ejsCompile = () => {
    gulp.src(paths.ejs.src, {since: gulp.lastRun(ejsCompile)})
        .pipe(plumber())
        .pipe(ejs({
            site: fs.readJsonSync(`gulp/gulp_option.json`).preview,
        }))
        .pipe(htmlbeautify({
            "indent_size": 2,
            "indent_char": " ",
            "max_preserve_newlines": 0,
            "preserve_newlines": false,
            "extra_liners": [],
        }))
        .on("'error", (error) => {
            console.log(error.message)
        })
        .on("end", () => {
            console.log("【Complete】ejs")
        })
        .pipe(rename({
            extname:'.html'
        }))
        .pipe(gulp.dest(paths.ejs.dist))
}

const ejsProduction = () => {
    gulp.src(paths.ejs.src, {since: gulp.lastRun(ejsCompile)})
        .pipe(plumber())
        .pipe(ejs({
            site: fs.readJsonSync(`gulp/gulp_option.json`).production,
        }))
        .pipe(htmlbeautify({
            "indent_size": 2,
            "indent_char": " ",
            "max_preserve_newlines": 0,
            "preserve_newlines": false,
            "extra_liners": [],
        }))
        .on("'error", (error) => {
            console.log(error.message)
        })
        .on("end", () => {
            console.log("【Complete】ejs")
        })
        .pipe(rename({
            extname:'.html'
        }))
        .pipe(streamify(lineEncoding(encodeOption)))
        .pipe(textEncoding({
            to: encode
        }))
        .pipe(gulp.dest(paths.ejs.htdocs))
}


const imageCompile = () => {
    gulp.src(paths.image.src, {since: gulp.lastRun(imageCompile)})
        .on("'error", (error) => {
            console.log(error.message)
        })
        .pipe(plumber())
        .pipe(imagemin([
            imagemin.svgo({
                plugins: [{
                    removeViewBox: false
                }]
            })
        ]))
        .pipe(gulp.dest(paths.image.dist))
        .pipe(tinyping({
            key: 'Xyw5vFB1pDg54f3gbq7qnrH9WGJ8vM0Z'
        }))
        .on("end", () => {
            console.log("【Complete】images")
        })
        .pipe(gulp.dest(paths.image.dist))
}

const imageProduction = () => {
    gulp.src(paths.image.src, {since: gulp.lastRun(imageCompile)})
        .pipe(plumber())
        .on("'error", (error) => {
            console.log(error.message)
        })
        .pipe(imagemin([
            imagemin.svgo({
                plugins: [{
                    removeViewBox: false
                }]
            })
        ]))
        .pipe(gulp.dest(paths.image.htdocs))
        .pipe(tinyping({
            key: 'Xyw5vFB1pDg54f3gbq7qnrH9WGJ8vM0Z'
        }))
        .on("end", () => {
            console.log("【Complete】images")
        })
        .pipe(gulp.dest(paths.image.htdocs))
}

const staticCompile = () => {
    gulp.src(paths.static.src, {since: gulp.lastRun(staticCompile)})
        .on("end", () => {
            console.log("【Complete】static")
        })
        .pipe(gulp.dest(paths.static.dist))
}
const staticProduction = () => {
    gulp.src(paths.static.src, {since: gulp.lastRun(staticCompile)})
        .on("end", () => {
            console.log("【Complete】static")
        })
        .pipe(gulp.dest(paths.static.htdocs))
}

const deleteDist = () => {
    return new Promise(resolve => {
        fs.remove("dist", (err) => {
            if (err) {
                throw err;
                console.error("distディレクトリの削除に失敗しました。");
            } else {
                resolve();
            }
        })
    })
}
const deleteHtdocs = () => {
    return new Promise(resolve => {
        fs.remove("htdocs", (err) => {
            if (err) {
                throw err;
                console.error("htdocsディレクトリの削除に失敗しました。");
            } else {
                resolve();
            }
        })
    })
}

function server() {
    browserSync.init({
        server: {
            baseDir: ["dist"],
            index  : "index.html",
        },
        startPath: "/",
        reloadOnRestart: true,
    });
}

function browserReload() {
    browserSync.reload();
    console.log(('reload done'));
}

function watchFiles() {
    watch("src/assets/scss/**/*.scss", scssCompile)

    watch(paths.js.src, jsCompile)

    watch("src/**/*.ejs", ejsCompile)
    watch(paths.component.src, ejsCompile)

    watch(paths.image.src, imageCompile)

    watch(paths.static.src, staticCompile)

    watch([paths.scss.src, paths.ejs.src, paths.js.src, paths.image.src, paths.component.src], browserReload)
}

const defaultFunc = () => {
    debug = true;
    scssCompile()
    jsCompile()
    ejsCompile()
    imageCompile()
    staticCompile()
    server()
    watchFiles()
}

const buildFunc = async () => {
    debug = false;
    await deleteDist()
    scssCompile()
    jsCompile()
    ejsCompile()
    imageCompile()
    staticCompile()
}

const buildProduction = async() => {
    await deleteHtdocs()
    scssProduction()
    jsProduction()
    ejsProduction()
    imageProduction()
    staticProduction()
}

gulp.task('default', defaultFunc)

gulp.task('js', (done) => {
    jsCompile()
    done()
})

gulp.task('build', (done) => {
    buildFunc().then(() => {
        done()
    })
})

gulp.task('js', (done) => {
    jsCompile()
    done()
})

gulp.task('ejs', (done) => {
    ejsCompile()
    done()
})

gulp.task('scss', (done) => {
    scssCompile()
    done()
})

gulp.task("production", (done) => {
    buildProduction().then(() => {
        done()
    })
})