# Usa una imagen oficial de Node.js liviana
FROM node:20-alpine

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# Copia los archivos de definición de dependencias
COPY package*.json ./

# Instala solo las dependencias de producción
RUN npm ci --only=production

# Copia el resto del código del proyecto
COPY . .

# Define el puerto por defecto (se puede sobreescribir en la nube)
ENV PORT=3000

# Expone el puerto configurado
EXPOSE $PORT

# Comando para iniciar la aplicación
CMD ["node", "server.js"]