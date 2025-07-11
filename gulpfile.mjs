import gulp from "gulp";
import babel from "gulp-babel";
import uglify from 'gulp-uglify'
import { deleteAsync } from 'del'

function js_build() {
    return gulp.src("src/**/*.*")
        .pipe(babel())                //语法编译
        .pipe(uglify())               //代码压缩
        .pipe(gulp.dest("dist"));
}

// 复制 src/template 目录到 dist 目录
function copyTemplate() {
    return gulp.src("src/template/**/.vscode/**/*.*")
        .pipe(gulp.dest("dist/template"));
}

// 删除 dist 目录
async function clean() {
    return deleteAsync(['dist/**', '!dist']);
}

// 多任务合并执行
gulp.task("default", gulp.series(clean, js_build, copyTemplate));
