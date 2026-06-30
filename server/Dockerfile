FROM denoland/deno:2

WORKDIR /app

COPY deno.json deno.lock ./
RUN deno install

COPY . .

EXPOSE 3000
CMD ["deno", "task", "start"]
