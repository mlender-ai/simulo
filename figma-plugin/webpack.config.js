const HtmlWebpackPlugin = require("html-webpack-plugin");
const HtmlInlineScriptPlugin = require("html-inline-script-webpack-plugin");
const path = require("path");

module.exports = (env, argv) => ({
  mode: argv.mode === "production" ? "production" : "development",
  devtool: argv.mode === "production" ? false : "inline-source-map",

  entry: {
    code: "./src/plugin/code.ts",
    ui: "./src/ui/ui.ts",
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },

  resolve: {
    extensions: [".ts", ".tsx", ".js"],
  },

  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist"),
    clean: true,
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/ui/index.html",
      filename: "ui.html",
      chunks: ["ui"],
      cache: false,
      inject: "body",
    }),
    new HtmlInlineScriptPlugin({
      htmlMatchPattern: [/ui.html$/],
      scriptMatchPattern: [/.js$/],
    }),
  ],
});
