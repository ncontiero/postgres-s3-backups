/* eslint-disable no-console */

type LOG_TYPE = "info" | "success" | "error" | "warn";

const ANSI_RESET = "\u{1B}[0m";
const colors = {
  info: "blue",
  success: "green",
  error: "red",
  warn: "yellow",
};

function colorize(type: LOG_TYPE, data: string | number) {
  const color = Bun.color(colors[type], "ansi");
  return color ? `${color}${data}${ANSI_RESET}` : String(data);
}

function createLogger(type: LOG_TYPE, ...data: (string | number)[]) {
  const args = data.map((item) => colorize(type, item));

  if (type === "error") {
    console.error(...args);
  } else {
    console.log(...args);
  }
}

function createLoggerMethod(type: LOG_TYPE) {
  return (...args: (string | number)[]) => createLogger(type, ...args);
}

export const logger = {
  error: createLoggerMethod("error"),
  warn: createLoggerMethod("warn"),
  info: createLoggerMethod("info"),
  success: createLoggerMethod("success"),
  break: () => console.log(""),
};
