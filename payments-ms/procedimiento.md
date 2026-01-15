Saltar al contenido principal
Wompi-Docs
Colombia
Español

EMPIEZA
Inicio rápido
Conoce nuestros planes
GUÍAS
Ambientes y llaves
Widget & Checkout Web
Datos de prueba en Sandbox
Eventos
Seguimiento de transacciones
Reintento de pagos
Roles
Usuarios
Reporte único
Reporte recurrente
PLUGINS DE ECOMMERCE
WooCommerce (Wordpress)
Shopify
Jumpseller
Magento
PrestaShop
VTEX
PAGOS A TERCEROS
¿Qué es Pagos a terceros?
Activación
Configuración inicial
Consulta de saldo
Crear pago: Manual
Crear pago: Mediante archivo
Cuentas bancarias para dispersión
Historial transacciones
Límites transacciones
Pruebas en Sandbox
Reportes transacciones
Roles
Usuarios
API: Usa nuestra API
API: Llaves de autenticación
API: Crea tu primer lote:
API: Ambiente sandbox
API: Consultas y operaciones
API: Eventos
API: Referencia del API
API: Errores
USA NUESTRO API
Tokens de aceptación
Métodos de pago
Fuentes de pago & Tokenización
Transacciones automáticas con el protocolo 3RI
Transacciones con 3D Secure (Sandbox) v2
Fuentes de Pago Seguras con 3D Secure (Sandbox)
Integración de 3D Secure externo
Errores
Impuestos
Referencia del API
Links de pago
USA NUESTRA LIBRERIA
WompiJs
WompiJs - deprecada
Ambiente sandbox
El ambiente sandbox de la API de Pagos a Terceros es un entorno de pruebas diseñado para que desarrolladores e integradores puedan simular transacciones y validar sus integraciones de forma segura, sin procesar pagos reales. Este entorno replica el comportamiento del ambiente de producción, permitiendo probar flujos de pago, validaciones de seguridad, respuestas del API y manejo de errores sin afectar a usuarios finales ni generar cargos reales.

En esta documentación encontrarás todo lo necesario para comenzar a trabajar con el sandbox: cómo obtener credenciales de prueba, ejemplos de peticiones, escenarios simulables y buenas prácticas para asegurar una integración exitosa antes del paso a producción.

Importante
Aunque los datos y comportamientos en sandbox imitan el entorno de producción, pueden existir ligeras diferencias. Asegúrate de realizar pruebas completas antes de lanzar tu integración al público.

Llaves de sandbox
Las llaves de sandbox se obtienen de la misma manera que las llaves productivas, con la particularidad de que el ingresar a la página de programadores se debe cambiar al modo normal, como se muestra a continuación:

Ver llaves sandbox

Desde el modo sandbox también se permite:

Ver llaves
Regenerar llaves
Configurar URL de eventos
Ver secreto para la integración de eventos
URL Base de Sandbox
Todos los endpoints productivo estan disponible en el ambiente sandbox

https://api.sandbox.payouts.wompi.co/v1

Recuerda usar las cabeceras (headers) de todas las solicitudes que se realicen tambien en la API de sandbox. Ejemplo:

user-principal-id: {ID_Usuario_Principal}
x-api-key: {API_Key}

Simular estado de transacciones
En sandbox la solicitud de creación de pago manual (en formato JSON) o por archivo son iguales, la única diferencia es que desde sandbox se permite definir el estado final de las transacciones, para que estas queden aprobadas (APPROVED) o fallidas (FAILED)

Nota
Este campo es opcional; si no se envía, por defecto las transacciones quedan aprobadas (APPROVED)

Pago manual
Para simular el estado final de las transacciones, se debe enviar la propiedad transactionStatus (ver línea 5) con el valor APPROVED o FAILED.

{
  "reference": "payment-reference",
  "accountId": "account-id",
  "paymentType": "PAYROLL",
  "transactionStatus": "FAILED",
  "transactions": [
    {
      "legalIdType": "CC",
      "legalId": "1000000000",
      "bankId": "00000000-0000-0000-0000-000000000000",
      "accountType": "AHORROS",
      "accountNumber": "00000000",
      "name": "John Doe",
      "email": "email@example.com",
      "amount": 1000000,
      "reference": "custom-transaction-reference"
    }
  ]
}

Pago por archivo
Se debe agregar la propiedad transactionStatus al form-data.

Recargar saldo de una cuenta
El entorno sandbox de Wompi incluye un endpoint exclusivo para recargar saldo en cuentas de prueba, permitiendo simular operaciones que requieren fondos disponibles.

Importante
Esta funcionalidad solo está disponible en sandbox y no afecta cuentas reales.

La URL del endpoint para recargar cuenta es:

POST /accounts/balance-recharge

Se debe enviar en el body de la petición los campos de accountId (id de la cuenta a recargar) y amount (cantidad a recargar en centavos). Debe ser minimo $1000,00 y maximo $50.000.000,00

Nota
El accoutId se obtiene al consultar las cuentas. VerConsultar cuentas y saldos

{
  "accountId": "account-id",
  "amountInCents": 340000000
}

API: Crea tu primer lote:
API: Consultas y operaciones
Llaves de sandbox
Simular estado de transacciones
Pago manual
Pago por archivo
Recargar saldo de una cuenta

Inicio rápido.Widget & Checkout Web

Copyright © 2023 Wompi


Saltar al contenido principal
Wompi-Docs
Colombia
Español
EMPIEZA
Inicio rápido
Conoce nuestros planes
GUÍAS
Ambientes y llaves
Widget & Checkout Web
Datos de prueba en Sandbox
Eventos
Seguimiento de transacciones
Reintento de pagos
Roles
Usuarios
Reporte único
Reporte recurrente
PLUGINS DE ECOMMERCE
WooCommerce (Wordpress)
Shopify
Jumpseller
Magento
PrestaShop
VTEX
PAGOS A TERCEROS
¿Qué es Pagos a terceros?
Activación
Configuración inicial
Consulta de saldo
Crear pago: Manual
Crear pago: Mediante archivo
Cuentas bancarias para dispersión
Historial transacciones
Límites transacciones
Pruebas en Sandbox
Reportes transacciones
Roles
Usuarios
API: Usa nuestra API
API: Llaves de autenticación
API: Crea tu primer lote:
API: Ambiente sandbox
API: Consultas y operaciones
API: Eventos
API: Referencia del API
API: Errores
USA NUESTRO API
Tokens de aceptación
Métodos de pago
Fuentes de pago & Tokenización
Transacciones automáticas con el protocolo 3RI
Transacciones con 3D Secure (Sandbox) v2
Fuentes de Pago Seguras con 3D Secure (Sandbox)
Integración de 3D Secure externo
Errores
Impuestos
Referencia del API
Links de pago
USA NUESTRA LIBRERIA
WompiJs
WompiJs - deprecada
Inicio rápido
¡Bienvenido! A continuación te explicamos rápidamente que necesitas para comenzar a recibir pagos con Wompi.

Antes de empezar
Para usar Wompi necesitas un par de llaves de autenticación asociadas a tu comercio. Puedes leer toda la información referente a llaves de autenticación y ambientes de ejecución haciendo clic aquí.

Si todavía no tienes estas llaves, regístrate en comercios.wompi.co y obtén tu par de llaves de Wompi, para que comiences a integrar tu comercio.

En Wompi hay tres formas de recibir pagos, a continuación encuentras un resumen de cómo funciona cada una:

Widget & Checkout Web
Recibe pagos en tu sitio web con nuestro botón de pagos
Widget dentro de tu sitio web

Usando tan solo unas pocas líneas de HTML, integra nuestro Widget de pagos, para que tus clientes puedan pagar sin tener que salir de tu sitio web. También puedes usar un formulario HTML para redireccionarlos a una página de pago dentro de nuestro Checkout Web seguro.

Para usar este método de integración haz clic aquí.

Plugins de eCommerce
Recibe pagos en tu tienda en línea en segundos
Configura el plugin de WooCommerce en segundos

Ahora puedes vender y cobrarle a tus en tu tienda en línea, usando nuestros plugins de eCommerce.

Mira cómo funciona nuestro plugin de WooCommerce (para sitios WordPress) haciendo clic aquí.

API de pagos
Haz una integración totalmente a la medida
Ejemplo de tokenización de una tarjeta de crédito

Creamos el API RESTful de pagos más simple, seguro y poderoso del mercado. Puedes crear integraciones a la medida y experiencias de pago únicas para web, móvil o donde quieras. Nuestro API es simple e intuitivo y te permite hacer transacciones con varios medios de pago y consultar el estado de las mismas muy fácilmente. También es posible tokenizar tarjetas de crédito para hacer pagos recurrentes o implementar usos más complejos, si tu modelo de negocio así lo requiere.

Haz click aquí para ver la referencia completa de nuestro API. Y lee más sobre los métodos de pago disponibles en el API haciendo clic aquí.

¡Habla con nosotros!
Si tienes alguna duda, sugerencia o comentario, no dudes en escribirnos aquí
¡Gracias por usar Wompi!

Conoce nuestros planes
Antes de empezar
Widget & Checkout Web
Recibe pagos en tu sitio web con nuestro botón de pagos
Plugins de eCommerce
Recibe pagos en tu tienda en línea en segundos
API de pagos
Haz una integración totalmente a la medida

Inicio rápido.Widget & Checkout Web

Copyright © 2023 Wompi

Saltar al contenido principal
Wompi-Docs
Colombia
Español
EMPIEZA
Inicio rápido
Conoce nuestros planes
GUÍAS
Ambientes y llaves
Widget & Checkout Web
Datos de prueba en Sandbox
Eventos
Seguimiento de transacciones
Reintento de pagos
Roles
Usuarios
Reporte único
Reporte recurrente
PLUGINS DE ECOMMERCE
WooCommerce (Wordpress)
Shopify
Jumpseller
Magento
PrestaShop
VTEX
PAGOS A TERCEROS
¿Qué es Pagos a terceros?
Activación
Configuración inicial
Consulta de saldo
Crear pago: Manual
Crear pago: Mediante archivo
Cuentas bancarias para dispersión
Historial transacciones
Límites transacciones
Pruebas en Sandbox
Reportes transacciones
Roles
Usuarios
API: Usa nuestra API
API: Llaves de autenticación
API: Crea tu primer lote:
API: Ambiente sandbox
API: Consultas y operaciones
API: Eventos
API: Referencia del API
API: Errores
USA NUESTRO API
Tokens de aceptación
Métodos de pago
Fuentes de pago & Tokenización
Transacciones automáticas con el protocolo 3RI
Transacciones con 3D Secure (Sandbox) v2
Fuentes de Pago Seguras con 3D Secure (Sandbox)
Integración de 3D Secure externo
Errores
Impuestos
Referencia del API
Links de pago
USA NUESTRA LIBRERIA
WompiJs
WompiJs - deprecada
Widget & Checkout Web
Acepta pagos en tu sitio web en minutos usando una de nuestras dos opciones de Checkout:
Widget	Web Checkout
Permite que tus clientes completen el pago sin salir de tu sitio web, dentro de nuestro widget de pagos, simplemente incluyendo una etiqueta <script> (debes poder incluir Javascript en tu sitio). Puedes ver un ejemplo a continuación	Deja que tus clientes completen el pago fuera de tu website, a través de nuestro Checkout usando un formulario HTML estándar
Ambos métodos de integración ofrecen una experiencia de pago rápida y segura para tus clientes.

Paso a paso
Paso 1 — Alista tu llave pública de comercio
Paso 2 — Genera una referencia única de pago
Paso 3 — Genera una firma de integridad
Paso 4 — Prepara una URL de redirección para el momento de finalizar el pago
Paso 5 — Ten en cuenta los parámetros obligatorios y opcionales de una transacción
Paso 6 — Escoge un método de integración de checkout
Paso 7 — Escucha el evento de una transacción en tu servidor con un webhook
Usa HTTPS
Te recomendamos fuertemente usar HTTPS en tu sitio web, ya que no sólo tus clientes se sentirán más seguros a la hora de navegar y hacer pagos, sino que también evitarás que tu sitio sea marcado como "No seguro", un cambio que Google Chrome alertó que haría desde el 24 de julio de 2018. Algo importante a tener en cuenta ya que sólo este navegador representa más del 60% del tráfico en la web.
Paso 1: Alista tu llave pública de comercio
Para cualquiera de las integraciones que hagas con Wompi, deberás contar con una llave pública de comercio, que se ve como la siguiente:

pub_prod_Kw4aC0rZVgLZQn209NbEKPuXLzBD28Zx

Obtén tus llaves Wompi
Para obtener tus par de llaves Wompi, sólo debes registrarte en nuestro dashboard de Comercios si aún no lo has hecho. ¡Es así de fácil!
Esta llave nos permite identificarte cada vez que se procesa un pago a través de Wompi. Si no tienes tu llave pública aún, haz clic acá para entender cómo obtener una llave pública de comercio.

¡Recuerda que hay llaves de sandbox y producción!
Las llaves de sandbox (entorno de pruebas) tienen el prefijo pub_test_, mientras que las de producción tienen el prefijo pub_prod_. Para transacciones con dinero real usa la llave de Producción; para hacer transacciones de prueba, mientras integras y desarrollas, usa la llave de Sandbox.
Paso 2: Genera una referencia única de pago
Para cada compra que tus clientes hagan en tu website, deberás generar una referencia única de pago (similar a como funciona un número de factura en el mundo real). De esta manera podrás hacer seguimiento a cada transacción que se complete en Wompi y evitarás duplicar transacciones por accidente. Esto quiere decir que una vez se complete una transacción, no podrás reutilizar una referencia que ya exista en tu base de datos.

Recomendamos usar referencias numéricas o alfanuméricas, que pueden o no incluir guiones (-) o guiones bajos (_). Los siguientes son ejemplos de referencias válidas:

3b4393bafed398ba2
54937
10384200283
58e281-177ab976cbf9-d162d2
38932_3293298
0f760951ed_a0086f
Paso 3: Genera una firma de integridad
Para validar la integridad de la información de la transacción y evitar alteraciones, Wompi utiliza un hash criptográfico asimétrico.

Para generar este hash criptográfico, busca el secreto de integridad accediendo al dashboard de comercios en "Desarrolladores > Secretos para integración ténica", se debería ver algo como esto:

Llave de integridad en Dashboard de Comercios Wompi

Es importante que aclarar que este Secreto para Integridad es diferente de tu Llave Privada y Llave Pública.


  prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6

Después de tener listo tu secreto de integración, deberas generar un hash SHA256 con la siguiente información (el orden importa):

Referencia de la transacción: sk8-438k4-xmxm392-sn2m
Monto de la transacción en centavos: 2490000
Moneda de la transacción: COP
Secreto de integridad: prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6
Estos valores se concatenan:

  "<Referencia><Monto><Moneda><SecretoIntegridad>"

Así se vería con valores de ejemplo:

  "sk8-438k4-xmxm392-sn2m2490000COPprod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6"

Importante, al usar el parámetro expiration-time se deberá concatenar como valor adicional:

Fecha de expiración: 2023-06-09T20:28:50.000Z
Los valores anteriores se concatenan con el valor adicional en el siguiente orden:

  "<Referencia><Monto><Moneda><FechaExpiracion><SecretoIntegridad>"

Así se verían con el valor adicional de ejemplo:

  "sk8-438k4-xmxm392-sn2m2490000COP2023-06-09T20:28:50.000Zprod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6"


Y lo encriptamos con SHA256:

Te recomendamos fuertemente crear este hash criptografico en tu servidor y nunca en tu frontend, pues expondrías el secreto de integración a un potencial atacante
En Ruby:

    #como se escribe
    Digest::SHA2.hexdigest($cadena_concatenada)
    #ejemplo
    Digest::SHA2.hexdigest("sk8-438k4-xmxm392-sn2m2490000COPprod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6") #"37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5"


En Php:

  // Cómo se escribe
  hash ("sha256", $cadena_concatenada);
  // Ejemplo
  hash ("sha256", "sk8-438k4-xmxm392-sn2m2490000COPprod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6"); //"37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5"


En Javascript:

var cadenaConcatenada =
  "sk8-438k4-xmxm392-sn2m2490000COPprod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6";
//Ejemplo
const encondedText = new TextEncoder().encode(cadenaConcatenada);
const hashBuffer = await crypto.subtle.digest("SHA-256", encondedText);
const hashArray = Array.from(new Uint8Array(hashBuffer));
const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join(""); // "37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5"


En Python:

  import hashlib
  # Ejemplo
  cadena_concatenada = "sk8-438k4-xmxm392-sn2m2490000COPprod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6"
  m = hashlib.sha256()
  m.update(bytes(cadena_concatenada))
  m.digest()
  #"37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5"

Este valor debemos enviarlo en la atributo signature:integrity:

<form>
  <script
    data-signature:integrity="37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5"
    ...
  ></script>
</form>

Paso 4: URL de redirección
Al finalizar una transacción, opcionalmente, Wompi puede redirigir al usuario a una URL (que debe pertenecer a tu sitio web), en la cual podrás consultar el resultado final (status) de la transacción. Esto lo puedes hacer usando el id de la transacción, el cual estará disponible como un parámetro de la URL.

Así por ejemplo, si tu URL es:

https://mitienda.com.co/pagos/respuesta

La URL a la que Wompi redirigirá es similar a la siguiente:

https://mitienda.com.co/pagos/respuesta?id=01-1531231271-19365

Así, puedes usar el parámetro id disponible en la URL para verificar la transacción usando nuestro API apuntando a la URL https://production.wompi.co/v1/transactions/<ID_TRANSACCION>. Por ejemplo https://production.wompi.co/v1/transactions/01-1531231271-19365 (este ID puede NO ser real y sirve solo para dar un ejemplo)

Paso 5: Parámetros de la transacción
Para cada transacción puedes proveer parámetros como el monto a cobrar, la moneda en la que quieres cobrar, etc. Algunos de estos parámetros son obligatorios y otros son opcionales.

Parámetros obligatorios
Los siguientes son los parámetros obligatorios que debes tener en cuenta para crear una transacción:

public-key (Llave pública de comercio): Llave pública de comercio.
currency (Moneda): Moneda en la que vas a hacer el cobro. La única moneda disponible actualmente es COP (pesos colombianos).
amount-in-cents (Monto en centavos): Monto a cobrar, en centavos. Por ejemplo si deseas cobrar $95.000 COP, deberás ingresar: 9500000
reference (Referencia única de pago): Referencia única de pago.
signature:integrity (Firma de integridad): Es un hash criptográfico que utilizamos para validar la integridad de la información de la transacción y evitar alteraciones.
Parámetros opcionales
Los siguientes son parámetros opcionales que, aunque no sean necesarios, proveen una mejor experiencia de integración:

redirect-url (URL de redirección): Es la URL a la que el usuario será redirigido luego completar el proceso de pago, conteniendo el id de la transacción respectiva.
shipping-address (Información de envío): Es la información de dirección de envío del cliente, donde recibirá los productos y/o servicios, si aplica. Los datos que se pueden enviar son los siguientes:
address-line-1: (Obligatorio) para la dirección del lugar de la entrega
address-line-2: para referencias extras
country: (Obligatorio) para el código ISO 3166-1 Alpha-2 (2 letras mayúsculas) del país donde se encuentra la dirección (ej: CO)
city: (Obligatorio) para especificar la ciudad donde se encuentra la dirección
phone-number: (Obligatorio) para el número de teléfono de quien recibe
region: (Obligatorio) para la región donde se encuentra la dirección
name: para el nombre de quien recibe
postal-code: para el código postal
collect-shipping (Activar formulario de envío): Este parámetro activa la vista de información de envío, y si se diligenciaron los campos anteriores, aparecerán prellenados en la vista.
customer-data (Información del pagador): Es la información del pagador, la cual se prellenara en la vista de "Ingresa tus datos". Los datos permitidos son:
email: para el correo electrónico del pagador
full-name: para el nombre completo del pagador
phone-number: para el número de teléfono del pagador, debe ir acompañado del campo phone-number-prefix
phone-number-prefix: para el prefijo o código del país del teléfono del pagador (ej: +57), debe ir acompañado del campo phone-number
legal-id: para el número de documento de identidad del pagador, este parámetro activa el campo de documento de identidad del pagador en la vista de "Ingresa tus datos" y debe ir acompañado del campo legal-id-type
legal-id-type: para el tipo de documento del pagador, este parámetro activa el campo de documento de identidad del pagador en la vista de "Ingresa tus datos" y debe ir acompañado del campo legal-id. Los tipos de documento permitidos son:
CC: Cédula de Ciudadanía
CE: Cédula de Extranjería
NIT: Número de Identificación Tributaria
PP: Pasaporte
TI: Tarjeta de Identidad
DNI: Documento Nacional de Identidad
RG: Carteira de Identidade / Registro Geral
OTHER: Otro
collect-customer-legal-id: Activa el campo de documento de identidad del pagador, usando true como valor. Este parámetro activa el campo de documento de identidad del pagador en la vista de "Ingresa tus datos". Si se diligenciaron los campos de legal_id y legal_id_type de customer_data, se prellenara con dicha información
tax-in-cents (Detalle de impuestos en pago): Es la información de impuestos en la que puedes detallar el tipo de impuesto y el monto del impuesto dentro del precio total de la transacción en centavos. Más adelante se explica la manera de usarlo en las distintas formas de integración. Los tipos de impuestos permitidos son los siguientes:
VAT: para el IVA (Impuesto de Valor Agregado)
CONSUMPTION: para el Impuesto al Consumo
expiration-time: Fecha y hora en formato ISO8601 (UTC+0000), activa un contador regresivo indicando el tiempo restante para la expiración del inicio del pago
payment-method
reference-two: Fecha de apertura del producto en formato yyyymmdd
reference-three: Número de documento del beneficiario del producto financiero
A tener en cuenta: Con el fin de mitigar el fraude en el servicio PSE, se han definido acciones adicionales que deben ser implementadas por todas las empresas vinculadas a la categoría de Servicios Financieros. Entre estas acciones se encuentra la inclusión de tres campos obligatorios en la trama transaccional, relacionados con la dirección IP del usuario, la fecha de apertura del producto y la identificación del beneficiario.

De cumplir con la descripción anterior se recomienda enviar el objeto payment-method con los campos reference-one, reference-two, reference-three

Los impuestos no se sumarán al monto de la transacción
Es importante resaltar que los impuestos enviados en el objeto taxes no se sumarán al total de la transacción.
Por ejemplo, en una transacción cuyo total (amount_in_cents) es de COP$119,000 y cuyo IVA es de COP$19,000, este último monto ya hace parte del total, implicando entonces que: la base sin impuestos ($100,000) + el IVA ($19,000) = el total ($119,000).
En otras palabras, Wompi no sumará $19,000 a los $119,000, sino que simplemente compartirá esta información tributaria con el respectivo procesador del pago.
Paso 6: Escoge un método de integración
Escoge una de las dos opciones de integración:

Widget: Permite que tus clientes completen el pago dentro de tu sitio web en nuestro Widget.
Web: Tus clientes completan el pago en nuestro Web Checkout.
Widget
Este es el método más simple para que tus clientes completen un pago sin salir de tu sitio web. Con tan solo unas líneas de HTML, un botón de pagos se mostrará automáticamente.

Al hacer clic en el botón, el cliente continúa el proceso de pago dentro de nuestro widget, sin salir de tu sitio web (si quieres un botón a la medida, lee la sección de Botón personalizado).

A continuación verás un ejemplo del botón generado con el mismo código que encuentras debajo:

<form>
  <script
    src="https://checkout.wompi.co/widget.js"
    data-render="button"
    data-public-key="pub_test_X0zDA9xoKdePzhd8a0x9HAez7HgGO2fH"
    data-currency="COP"
    data-amount-in-cents="4950000"
    data-reference="4XMPGKWWPKWQ"
    data-signature:integrity="37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5"
  ></script>
</form>

El código que ves arriba tiene los parámetros mínimos necesarios para generar un botón de pago que permite a tu cliente pagar en nuestro widget. Así, sólo necesitas incluir una etiqueta <script> con los parámetros de la transacción, dentro de una etiqueta <form> en tu código, para generar el botón.

Sólo necesitas tener en cuenta tres cosas para generar el botón:

Incluye el parámetro data-render="button", que indica que quieres generar un botón automáticamente.
Para los parámetros listados arriba debes usar el prefijo data- en cada uno, para especificarlo (i.e. data-reference, data-currency, data-amount-in-cents, etc.) y usar guiones (-) en vez de guiones bajos (_) para los nombres de cada parámetro.
Para los parámetros de shipping-address, customer-data y tax-in-cents debes usar dos puntos (:) para especificar el tipo de información que se desea.
Un ejemplo con todos los parámetros se ve como el siguiente:

<form>
  <script
    src="https://checkout.wompi.co/widget.js"
    data-render="button"
    data-public-key="pub_test_X0zDA9xoKdePzhd8a0x9HAez7HgGO2fH"
    data-currency="COP"
    data-amount-in-cents="7890000"
    data-reference="37DNKF84S92N1S"
    data-signature:integrity="37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5"
    data-redirect-url="https://transaction-redirect.wompi.co/check"
    data-expiration-time="2023-06-09T20:28:50.000Z"
    data-tax-in-cents:consumption="590000"
    data-tax-in-cents:vat="1290000"
    data-customer-data:email="lola@perez.com"
    data-customer-data:full-name="Lola Perez"
    data-customer-data:phone-number="3019777777"
    data-customer-data:phone-number-prefix="+57"
    data-customer-data:legal-id="123456789"
    data-customer-data:legal-id-type="CC"
    data-shipping-address:address-line-1="Carrera 123 # 4-5"
    data-shipping-address:address-line-2="apto 123"
    data-shipping-address:country="CO"
    data-shipping-address:city="Bogota"
    data-shipping-address:phone-number="3019988888"
    data-shipping-address:region="Cundinamarca"
    data-shipping-address:name="Pedro Perez"
  ></script>
</form>

Web Checkout
Este es el método más rápido para integrar Wompi en tu sitio web, usando únicamente un formulario HTML estándar:

<form action="https://checkout.wompi.co/p/" method="GET">
  <!-- OBLIGATORIOS -->
  <input type="hidden" name="public-key" value="LLAVE_PUBLICA_DEL_COMERCIO" />
  <input type="hidden" name="currency" value="MONEDA" />
  <input type="hidden" name="amount-in-cents" value="MONTO_EN_CENTAVOS" />
  <input type="hidden" name="reference" value="REFERENCIA_DE_PAGO" />
  <input type="hidden" name="signature:integrity" value="FIRMA_DE_INTEGRIDAD" />
  <!-- OPCIONALES -->
  <input type="hidden" name="redirect-url" value="URL_REDIRECCION" />
  <input type="hidden" name="expiration-time" value="FECHA_EXPIRACION" />
  <input type="hidden" name="tax-in-cents:vat" value="IVA_EN_CENTAVOS" />
  <input
    type="hidden"
    name="tax-in-cents:consumption"
    value="IMPOCONSUMO_EN_CENTAVOS"
  />
  <input type="hidden" name="customer-data:email" value="CORREO_DEL_PAGADOR" />
  <input
    type="hidden"
    name="customer-data:full-name"
    value="NOMBRE_DEL_PAGADOR"
  />
  <input
    type="hidden"
    name="customer-data:phone-number"
    value="NUMERO_DE_TELEFONO_DEL_PAGADOR"
  />
  <input
    type="hidden"
    name="customer-data:legal-id"
    value="DOCUMENTO_DE_IDENTIDAD_DEL_PAGADOR"
  />
  <input
    type="hidden"
    name="customer-data:legal-id-type"
    value="TIPO_DEL_DOCUMENTO_DE_IDENTIDAD_DEL_PAGADOR"
  />
  <input
    type="hidden"
    name="shipping-address:address-line-1"
    value="DIRECCION_DE_ENVIO"
  />
  <input type="hidden" name="shipping-address:country" value="PAIS_DE_ENVIO" />
  <input
    type="hidden"
    name="shipping-address:phone-number"
    value="NUMERO_DE_TELEFONO_DE_QUIEN_RECIBE"
  />
  <input type="hidden" name="shipping-address:city" value="CIUDAD_DE_ENVIO" />
  <input type="hidden" name="shipping-address:region" value="REGION_DE_ENVIO" />
  <button type="submit">Pagar con Wompi</button>
</form>

De esta forma, sólo debes asegurarte de llenar correctamente los parámetros obligatorios e incluir este código en donde quieras que tus clientes vean el botón para completar el pago. Una vez hagan clic en él, serán llevados a nuestro Web Checkout donde podrán completar el pago de manera rápida y segura.

Paso 7: Escucha el evento de una transacción
Usa siempre los eventos para finalizar tu integración
Al haber integrado el Widget o Web Checkout en tu website, sólo resta que escuches un Evento en tu servidor, para enterarte cuando una transacción finalizó. No utilices la redirección como método de validación de tus transacciones, sino únicamente con propósitos informativos para tus usuarios.
Una vez un usuario haya finalizado una transacción, Wompi te informará a través de un Evento que la misma llegó a un estado final. Para ello deberás proveer una URL de Eventos (a webhook), donde Wompi te enviará un objeto JSON con la información completa de la transacción. Haz clic acá y visita la guía de Eventos para conocer en detalle todo sobre esta funcionalidad.

Botón personalizado (opcional)
Si quieres ofrecer una integración personalizada a tus clientes, como por ejemplo un botón con estilos propios, o abrir el widget dada cierta acción de un usuario, simplemente debes seguir los siguientes pasos:

Paso 1: Incluye el script del widget
Agrega esta etiqueta preferiblemente dentro del <head> de tu HTML:

<script
  type="text/javascript"
  src="https://checkout.wompi.co/widget.js"
></script>

Paso 2: Configura los datos de la transacción
Configura una instancia del checkout con el objeto de configuración, cuyos campos se muestran a continuación con valores de ejemplo. Todos son obligatorios, excepto redirectUrl.

var checkout = new WidgetCheckout({
  currency: 'COP',
  amountInCents: 2490000,
  reference: 'AD002901221',
  publicKey: 'pub_fENJ3hdTJxdzs3hd35PxDBSMB4f85VrgiY3b6s1',
  signature: {integrity : '3a4bd1f3e3edb5e88284c8e1e9a191fdf091ef0dfca9f057cb8f408667f054d0'}
  redirectUrl: 'https://transaction-redirect.wompi.co/check', // Opcional
  expirationTime: '2023-06-09T20:28:50.000Z', // Opcional
  taxInCents: { // Opcional
    vat: 1900,
    consumption: 800
  }
  customerData: { // Opcional
    email:'lola@gmail.com',
    fullName: 'Lola Flores',
    phoneNumber: '3040777777',
    phoneNumberPrefix: '+57',
    legalId: '123456789',
    legalIdType: 'CC'
  }
  shippingAddress: { // Opcional
    addressLine1: "Calle 123 # 4-5",
    city: "Bogota",
    phoneNumber: '3019444444',
    region: "Cundinamarca",
    country: "CO"
  }
})

Paso 3: Abre el widget
Finalmente, en el momento en que quieras abrir el widget que configuraste anteriormente, simplemente debes llamar la función open pasándole como parámetro una función de respuesta (callback) que te entregará información sobre la transacción tan pronto esta finalice. Por ejemplo:

checkout.open(function (result) {
  var transaction = result.transaction;
  console.log("Transaction ID: ", transaction.id);
  console.log("Transaction object: ", transaction);
});

Ambientes y llaves
Datos de prueba en Sandbox
Paso a paso
Paso 1: Alista tu llave pública de comercio
Paso 2: Genera una referencia única de pago
Paso 3: Genera una firma de integridad
Paso 4: URL de redirección
Paso 5: Parámetros de la transacción
Parámetros obligatorios
Parámetros opcionales
Paso 6: Escoge un método de integración
Widget
Web Checkout
Paso 7: Escucha el evento de una transacción
Botón personalizado (opcional)
Paso 1: Incluye el script del widget
Paso 2: Configura los datos de la transacción
Paso 3: Abre el widget

Inicio rápido.Widget & Checkout Web

Copyright © 2023 Wompi

Saltar al contenido principal
Wompi-Docs
Colombia
Español
EMPIEZA
Inicio rápido
Conoce nuestros planes
GUÍAS
Ambientes y llaves
Widget & Checkout Web
Datos de prueba en Sandbox
Eventos
Seguimiento de transacciones
Reintento de pagos
Roles
Usuarios
Reporte único
Reporte recurrente
PLUGINS DE ECOMMERCE
WooCommerce (Wordpress)
Shopify
Jumpseller
Magento
PrestaShop
VTEX
PAGOS A TERCEROS
¿Qué es Pagos a terceros?
Activación
Configuración inicial
Consulta de saldo
Crear pago: Manual
Crear pago: Mediante archivo
Cuentas bancarias para dispersión
Historial transacciones
Límites transacciones
Pruebas en Sandbox
Reportes transacciones
Roles
Usuarios
API: Usa nuestra API
API: Llaves de autenticación
API: Crea tu primer lote:
API: Ambiente sandbox
API: Consultas y operaciones
API: Eventos
API: Referencia del API
API: Errores
USA NUESTRO API
Tokens de aceptación
Métodos de pago
Fuentes de pago & Tokenización
Transacciones automáticas con el protocolo 3RI
Transacciones con 3D Secure (Sandbox) v2
Fuentes de Pago Seguras con 3D Secure (Sandbox)
Integración de 3D Secure externo
Errores
Impuestos
Referencia del API
Links de pago
USA NUESTRA LIBRERIA
WompiJs
WompiJs - deprecada
Datos de prueba en Sandbox
Para realizar una transacción de pruebas sólo debes asegurarte que estás usando la llave pública de comercio para el ambiente Sandbox. Recuerda que esta tiene el prefijo pub_test_.

A continuación verás los datos de prueba necesarios para cada uno de los métodos de pago:

Tarjetas
Para una transacción de pruebas con tarjeta puedes usar los siguientes números de tarjeta a la hora de usar el endpoint de tokenización (si usas una integración con API) o al llenar los datos de la tarjeta en el Widget, para obtener respuestas distintas:

4242 4242 4242 4242 para una transacción aprobada (APPROVED). Cualquier fecha de expiración en el futuro y CVC de 3 dígitos son válidos.
4111 1111 1111 1111 para una transacción declinada (DECLINED). Cualquier fecha de expiración en el futuro y CVC de 3 dígitos son válidos.
Si usas cualquier otra tarjeta que no sea alguna de estas dos, el estado final de la transacción será ERROR.

Nequi
Para realizar transacciones aprobadas o rechazadas en el ambiente Sandbox sólo debes tener en cuenta los siguientes números:

3991111111 para generar una transacción aprobada (APPROVED)
3992222222 para generar una transacción declinada (DECLINED)
Ten en cuenta que cualquier otro número que utilices resultará en una transacción con status final en ERROR.

Por ejemplo:

{
  // Otros campos de la transacción a crear...
  "payment_method": {
    "type": "NEQUI",
    "phone_number": "3991111111" // Esto resultará current una transacción APROBADA
  }
}

PSE
Para pagos con PSE, en caso de usar integración directa con el API debes enviar un tipo de banco específico, con la propiedad financial_institution_code del objeto payment_method, en el momento que estés creando una transacción (con el endpoint POST /transactions). Por ejemplo:

{
  // Otros campos de la transacción a crear...
  "payment_method": {
    "type": "PSE",
    "user_type": 0, // Tipo de persona, natural (0) o jurídica (1)
    "user_legal_id_type": "CC", // Tipo de documento, CC o NIT
    "user_legal_id": "1999888777", // Número de documento
    "financial_institution_code": "1", // "1" para transacciones APROBADAS, "2" para transacciones DECLINADAS
    "payment_description": "Pago a Tienda Wompi" // Nombre de lo que se está pagando. Máximo 30 caracteres
  }
}


Para la integración con Widget, verás listados los siguientes bancos para tu elección:

Banco que aprueba: Con este, obtienes una transacción APROBADA de PSE.
Banco que rechaza: Con este, obtienes una transacción DECLINADA de PSE.
Botón de Transferencia Bancolombia
Para pagos con Botón Bancolombia, en caso de usar integración directa con el API debes usar la propiedad sandbox_status dentro del objeto payment_method, en el momento que estés creando una transacción (con el endpoint POST /transactions). Por ejemplo:

{
  // Otros campos de la transacción a crear...
  "payment_method": {
    "type": "BANCOLOMBIA_TRANSFER",
    "payment_description": "Pago a Tienda Wompi", // Nombre de lo que se está pagando. Máximo 64 caracteres
  }
}


Una vez iniciada la transacción y consultando el estado de la misma se puede ejecutar la aprobación seleccionando el botón en la redirección del campo data -> payment_method -> async_payment_url

{
  "data": {
    "id": "11004-1718123303-80111",
    "created_at": "2024-06-11T16:28:23.299Z",
    "finalized_at": null,
    "amount_in_cents": 150000,
    "reference": "jvo4t513zc9",
    "currency": "COP",
    "payment_method_type": "BANCOLOMBIA_TRANSFER",
    "payment_method": {
      "type": "BANCOLOMBIA_TRANSFER",
      "extra": {
        "is_three_ds": false,
        "async_payment_url": "<<URL a cargar el paso de autenticación>>"
      },
      "user_type": "PERSON",
      "payment_description": "Prueba"
    },
    "payment_link_id": null,
    ............ Demas datos de respuesta

Esa URL te llevara la siguiente vista donde puedes seleccionar el estado en el que quires que la transacción termine

Bandbox AUTH Page

Bancolombia QR
Para pagos con Bancolombia QR, en caso de usar integración directa con el API debes usar la propiedad sandbox_status dentro del objeto payment_method, en el momento que estés creando una transacción (con el endpoint POST /transactions). Por ejemplo:

{
  // Otros campos de la transacción a crear...
  "payment_method": {
    "type": "BANCOLOMBIA_QR",
    "payment_description": "Pago a Tienda Wompi", // Nombre de lo que se está pagando. Máximo 64 caracteres
    "sandbox_status": "APPROVED" // Status final deseado en el Sandbox. Uno de los siguientes: APPROVED, DECLINED o ERROR
  }
}


Para la integración con Widget, verás listados los siguientes estados para tu elección:

Transacción APROBADA
Transacción DECLINADA
Transacción con ERROR
Puntos Colombia
Para pago con Puntos Colombia, en caso de usar integración directa con el API debes usar la propiedad sandbox_status dentro del objeto payment_method, en el momento que estés creando una transacción (con el endpoint POST /transactions). Ejemplo:

{
  // Otros campos de la transacción a crear...
  "payment_method": {
    "type": "PCOL",
    "sandbox_status": "APPROVED_ONLY_POINTS" // Status final deseado en el Sandbox.
  }
}

Los posibles estados de prueba para el campo sandbox_status son:

APPROVED_ONLY_POINTS: Pago total con puntos
APPROVED_HALF_POINTS: Pago 50% con puntos
DECLINED: Pago solo puntos declinado
ERROR: Error al realizar el pago con solo puntos
BNPL Bancolombia
Para el entorno de prueba de BNPL, la única variación que notarás es que la URL que te dirige a la experiencia de BNPL te llevará a una página donde podrás definir el estado final en el que concluirá la transacción. El aspecto del sitio web será el siguiente:

sandbox bnpl

DAVIPLATA - Pago simple
Cuando inicias una transacción con el medio de pago Daviplata y utilizas la interfaz proporcionada por Wompi, tendrás la posibilidad de elegir el estado final de la transacción, como se muestra en la siguiente imagen:

sandbox daviplata

Para llevar a cabo transacciones mediante la API, simplemente debes tener en cuenta los siguientes códigos OTP:

574829 para generar una transacción aprobada (APPROVED)
932015 para generar una transacción declinada (DECLINED)
186743 para generar una transacción declinada sin saldo (DECLINED)
999999 para generar una transacción error (ERROR)
DAVIPLATA - Pago recurrente
Para crear un token Daviplata podemos usar los siguientes numeros de prueba:

3991111111 para crear un token, y obtener transacciones aprobadas (APPROVED)
3992222222 para crear un token, y obtener transacciones declinadas (DECLINED)
3993333333 para crear un token declinado monedero invalido (DECLINED)
Codigos OTPs:

574829 para confirmar un token como aprobado (APPROVED)
932016 para confirmar un token como declinado por suscripción ya existente (DECLINED)
Para simular un mensaje de codigo OTP invalido debes ingresar cualquier numero de 6 digitos
Su+ Pay
Para el entorno de prueba de SU+ Pay, serás redirigido a una página donde podrás definir el estado final de la transacción. El aspecto del sitio web será el siguiente:

sandbox su + pay

Widget & Checkout Web
Eventos
Tarjetas
Nequi
PSE
Botón de Transferencia Bancolombia
Bancolombia QR
Puntos Colombia
BNPL Bancolombia
DAVIPLATA - Pago simple
DAVIPLATA - Pago recurrente
Su+ Pay

Inicio rápido.Widget & Checkout Web

Copyright © 2023 Wompi

Saltar al contenido principal
Wompi-Docs
Colombia
Español
EMPIEZA
Inicio rápido
Conoce nuestros planes
GUÍAS
Ambientes y llaves
Widget & Checkout Web
Datos de prueba en Sandbox
Eventos
Seguimiento de transacciones
Reintento de pagos
Roles
Usuarios
Reporte único
Reporte recurrente
PLUGINS DE ECOMMERCE
WooCommerce (Wordpress)
Shopify
Jumpseller
Magento
PrestaShop
VTEX
PAGOS A TERCEROS
¿Qué es Pagos a terceros?
Activación
Configuración inicial
Consulta de saldo
Crear pago: Manual
Crear pago: Mediante archivo
Cuentas bancarias para dispersión
Historial transacciones
Límites transacciones
Pruebas en Sandbox
Reportes transacciones
Roles
Usuarios
API: Usa nuestra API
API: Llaves de autenticación
API: Crea tu primer lote:
API: Ambiente sandbox
API: Consultas y operaciones
API: Eventos
API: Referencia del API
API: Errores
USA NUESTRO API
Tokens de aceptación
Métodos de pago
Fuentes de pago & Tokenización
Transacciones automáticas con el protocolo 3RI
Transacciones con 3D Secure (Sandbox) v2
Fuentes de Pago Seguras con 3D Secure (Sandbox)
Integración de 3D Secure externo
Errores
Impuestos
Referencia del API
Links de pago
USA NUESTRA LIBRERIA
WompiJs
WompiJs - deprecada
Eventos
Los eventos son la manera en la que Wompi te informa sobre algo importante que sucedió, sin que lo solicites activamente, usando un webhook. En pocas palabras, haremos una petición HTTP de tipo POST a una URL que especifiques, con un JSON que contiene toda la información relativa al evento que sucedió.

Así, por ejemplo, cada vez que una transacción sea aprobada o rechazada, Wompi te informará sobre esta actividad en la URL de eventos que hayas configurado en tu cuenta, con el fin de que tomes las medidas necesarias del lado de tu negocio. Para configurar dicha URL, lo puedes hacer en nuestro Dashboard de comercios.

Una URL de eventos para cada ambiente
Ten presente que tanto para Sandbox como Producción, debes configurar una URL de eventos diferente para cada ambiente. Esto, con el fin de evitar la mezcla accidental de transacciones de prueba con datos reales.

Manejar un evento
Cada vez que Wompi quiera notificar un evento a tu sistema, usará la URL de eventos, a la cual hará una petición HTTP de tipo POST, que contendrá un objeto como el que se muestra más abajo. A dicha petición HTTP, tu sistema deberá responder con un status HTTP 200 (que es el status de respuesta exitosa por defecto en los frameworks y librerías más populares). El cuerpo de respuesta que envíes no tiene importancia, ya que Wompi no lo utilizará de ninguna manera, así que puedes responder con un cuerpo vacío, un objeto JSON, etc.

Mientras el status HTTP de la respuesta por parte de tu sistema sea diferente a 200, Wompi considerará que el evento no pudo ser notificado correctamente y reintentará notificar nuevamente el evento, máximo 3 veces durante las siguientes 24 horas, hasta obtener un 200 como respuesta. El primer reintento será efectuado 30 minutos después, el segundo a las 3 horas y el último pasadas 24 horas.

Usa HTTPS
Te recomendamos usar HTTPS para la URL de eventos que especifiques. De esta manera se garantiza que la información viaja con encripción de punta a punta sin que nadie la pueda modificar durante el proceso de comunicación.
Cuerpo de un evento
Cualquier evento que Wompi envíe tendrá siempre la misma estructura:

{
  "event": "transaction.updated", // Nombre del tipo de evento
  "data": {
    // Data específica del evento
  },
  "environment": "prod", // "test" para Sandbox, "prod" para Producción
  "signature": {
    "properties": [
      // Lista de propiedades con las que se construye la firma
    ],
    "checksum": "..." // Hash calculado con una firma asimétrica SHA256
  },
  "timestamp": 1530291411, // Timestamp UNIX del evento usado para la firma del mismo
  "sent_at":  "2018-07-18T08:35:20.000Z" // Fecha current la que se notificó el evento por primera vez
}

Así por ejemplo, en el caso del evento transaction.updated, el cual indica que el estado de una transacción cambió, el cuerpo JSON enviado a la URL de eventos se verá como el siguiente:

{
  "event": "transaction.updated",
  "data": {
    "transaction": {
        "id": "1234-1610641025-49201",
        "amount_in_cents": 4490000,
        "reference": "MZQ3X2DE2SMX",
        "customer_email": "juan.perez@gmail.com",
        "currency": "COP",
        "payment_method_type": "NEQUI",
        "redirect_url": "https://mitienda.com.co/pagos/redireccion",
        "status": "APPROVED",
        "shipping_address": null,
        "payment_link_id": null,
        "payment_source_id": null
      }
  },
  "environment": "prod",
  "signature": {
    "properties": [
      "transaction.id",
      "transaction.status",
      "transaction.amount_in_cents"
    ],
    "checksum": "3476DDA50F64CD7CBD160689640506FEBEA93239BC524FC0469B2C68A3CC8BD0"
  },
  "timestamp": 1530291411,
  "sent_at":  "2018-07-20T16:45:05.000Z"
}

Tipos de eventos
A continuación encuentras una lista con los tipos de eventos que Wompi usa. Esta lista puede crecer con el tiempo, así que te sugerimos consultarla periódicamente:

Tipo	Descripción
transaction.updated	El estado de una transacción cambió, usualmente a un estado final (APPROVED, VOIDED, DECLINED o ERROR)
nequi_token.updated	El estado de un token de Nequi cambió, usualmente a un estado final (APPROVED o DECLINED)
bancolombia_transfer_token.updated	El estado de un token de Bancolombia cambió, usualmente a un estado final (APPROVED o DECLINED)
Seguridad
Para validar la integridad de la información notificada a tu URL de eventos y evitar suplantaciones, Wompi utiliza un hash criptográfico asimétrico, cuyo valor se encuentra en dos sitios:

El Header HTTP X-Event-Checksum
El campo checksum, del objeto signature
Los proveemos en ambos sitios por conveniencia, así que eres libre de extraerlo de cualquiera de los dos para hacer la respectiva validación de seguridad.

El algoritmo usado para generar esta firma asimétrica es SHA256. El valor de este checksum se genera concantenando en orden lo siguientes datos:

Los valores de los campos especificados en el arreglo properties, que apuntan a campos del objeto data
El campo timestamp (número entero) que es el Tiempo UNIX del evento
Un Secreto conocido únicamente por el comercio y Wompi, que está disponible en la opción Mi cuenta del Dashboard de Comercios, bajo la sección Secretos para integración técnica. Este secreto debe ser custodiado con la máxima seguridad en tus servidores
Paso a paso: Verifica la autenticidad de un evento
Siguiendo estas instrucciones, explicamos a continuación cómo calcular y validar por ejemplo el checksum del evento de una Transacción, mostrado más arriba, paso a paso:

Paso 1: Concatena los valores de los datos del evento
En el objeto signature del evento debes concatenar el valor de los datos descritos en el campo properties. En este caso tenemos:

transaction.id: Cuyo valor es 1234-1610641025-49201
transaction.status: Cuyo valor es APPROVED
transaction.amount_in_cents: Cuyo valor es 4490000
El valor resultante de la concatenación de estos datos, respetando el orden especificados en el arreglo signature.properties es:

1234-1610641025-49201APPROVED4490000

Los properties pueden variar.
Los valores del campo properties pueden variar en el tiempo y en cada evento, por eso es muy importante que no los asumas como un arreglo fijo dentro de tu código, sino que siempre los extraigas del evento y utilices apropiadamente en cada validación.
Paso 2: Concatena el campo timestamp
A la concatenación de las propiedades mostradas en el Paso 1, debes concatenarle también el campo timestamp del evento, que en este caso es 1530291411. El valor que deberías tener ahora en la cadena en este punto es:

1234-1610641025-49201APPROVED44900001530291411

Paso 3: Concatena tu secreto
En este paso debes concatenar tu secreto al string que estás generando hasta este punto. Vamos a asumir, en este ejemplo, que tu secreto es:

prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z

El Secreto de Eventos es distinto a la Llave Privada
Es importante que aclarar que este Secreto para Eventos es diferente de tu Llave Privada y Llave Pública.
El resultado final de la concatenación debería ser:

1234-1610641025-49201APPROVED44900001530291411prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z

Paso 4: Usa SHA256 para generar el checksum
Con estos datos concatenados apropiadamente, es momento de generar el checksum usando SHA256. Pasando la cadena por este algoritmo se obtiene por ejemplo el siguiente resultado:

3476DDA50F64CD7CBD160689640506FEBEA93239BC524FC0469B2C68A3CC8BD0

La manera en la que usa SHA256 para calcular este valor, varía dependiendo de cada lenguaje de programación. Sin embargo, el resultado debe ser siempre el mismo, dada la naturaleza de este algoritmo seguro de encripción asimétrica. Mostramos algunos ejemplos a continuación:

PHP
// Cómo se escribe
hash ("sha256", $cadena_concatenada);
// Ejemplo
hash ("sha256", "1234-1610641025-49201APPROVED44900001530291411prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z");


Ruby
# Cómo se escribe
Digest::SHA256.hexdigest(cadena_concatenada)
# Ejemplo
Digest::SHA256.hexdigest("1234-1610641025-49201APPROVED44900001530291411prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z")


Paso 5: Compara tu checksum calculado con el proveído en el evento
Al generar, tú mismo, el valor del checksum en tu servidor, puedes ahora compararlo con el que llegó en el evento. Si ambos son iguales entonces puedes estar seguro que la información presentada es legítima y enviada por Wompi, y no una suplantación de un tercero. De lo contrario, debes ignorar dicho evento.

Datos de prueba en Sandbox
Seguimiento de transacciones
Manejar un evento
Cuerpo de un evento
Tipos de eventos
Seguridad
Paso a paso: Verifica la autenticidad de un evento
Paso 1: Concatena los valores de los datos del evento
Paso 2: Concatena el campo timestamp
Paso 3: Concatena tu secreto
Paso 4: Usa SHA256 para generar el checksum
Paso 5: Compara tu checksum calculado con el proveído en el evento

Inicio rápido.Widget & Checkout Web

Copyright © 2023 Wompi

Saltar al contenido principal
Wompi-Docs
Colombia
Español
EMPIEZA
Inicio rápido
Conoce nuestros planes
GUÍAS
Ambientes y llaves
Widget & Checkout Web
Datos de prueba en Sandbox
Eventos
Seguimiento de transacciones
Reintento de pagos
Roles
Usuarios
Reporte único
Reporte recurrente
PLUGINS DE ECOMMERCE
WooCommerce (Wordpress)
Shopify
Jumpseller
Magento
PrestaShop
VTEX
PAGOS A TERCEROS
¿Qué es Pagos a terceros?
Activación
Configuración inicial
Consulta de saldo
Crear pago: Manual
Crear pago: Mediante archivo
Cuentas bancarias para dispersión
Historial transacciones
Límites transacciones
Pruebas en Sandbox
Reportes transacciones
Roles
Usuarios
API: Usa nuestra API
API: Llaves de autenticación
API: Crea tu primer lote:
API: Ambiente sandbox
API: Consultas y operaciones
API: Eventos
API: Referencia del API
API: Errores
USA NUESTRO API
Tokens de aceptación
Métodos de pago
Fuentes de pago & Tokenización
Transacciones automáticas con el protocolo 3RI
Transacciones con 3D Secure (Sandbox) v2
Fuentes de Pago Seguras con 3D Secure (Sandbox)
Integración de 3D Secure externo
Errores
Impuestos
Referencia del API
Links de pago
USA NUESTRA LIBRERIA
WompiJs
WompiJs - deprecada
Seguimiento de transacciones
En Wompi, hay varias maneras a través de las cuales podrás saber el estado de una transacción, una vez iniciado un proceso de pago por parte un cliente de tu comercio.

Notificaciones por correo
Cada vez que se complete una transacción en Wompi, tanto el usuario como el comercio recibirán una notificación vía e-mail con el resultado de la misma. El correo enviado contiene los detalles del método de pago y datos específicos de éste. Esta es la manera más simple en la que ambas partes son notificadas de una transacción en Wompi, sin necesidad de configurar o integrar nada previamente.

Cómo identificar una transacción
Una vez se crea una transacción en Wompi, existen varios datos disponibles que te permitirán identificarla, bien sea para cruzarla con información de tus sistemas internos, o simplemente para tener una trazabilidad de tus ventas. Los atributos más importantes que debes tener en cuenta cuando Wompi te informa sobre una transacción, o tú mismo consultas una utilizando nuestro API, son los siguientes:

id: Es el identificador único de la transacción que genera Wompi. Este será un texto que te permitirá identificar tu transacción de manera unívoca en nuestro sistema. Un id de transacción se ve como el siguiente: 1132-903100443-27458
reference: Es la referencia que tú como comercio asignaste previamente a la transacción, al momento de crearla, o en su defecto es una referencia generada automáticamente en el caso de los links de pago. Esta debe ser única. Puede ser cualquier tipo de texto, usualmente te recomendamos que sea alfanumérico, con o sin guiones o guiones bajos, por ejemplo: 3893893, wqu3Xshw3aaKgM42S, etc.
customer_email: Es el correo electrónico de la persona que realizó el pago.
amount_in_cents: Monto en centavos de la transacción. Por ejemplo, para $9.500 es 950000
created_at: La fecha y hora en la que se creó la transacción, en UTC (GMT-0), por ejemplo 2018-06-12T13:14:01.000Z.
finalized_at: La fecha y hora en que la transacción pasó a su estado final, en UTC (GMT-0), por ejemplo 2018-06-12T13:14:01.000Z.
payment_method_type: Forma de pago, que puede ser CARD (tarjeta de crédito o débito), NEQUI o PSE.
Estado de una transacción
El status, o estado de una transacción representa en qué punto del proceso de pago se encuentra la misma. El status permite saber si la transacción sigue en proceso (estado PENDING) o si ya llegó a un estado final.

El estado final de una transacción es uno de los siguientes:

APPROVED: Transacción aprobada
DECLINED: Transacción rechazada
VOIDED: Transacción anulada (sólo aplica pra transacciones con tarjeta)
ERROR: Error interno del método de pago respectivo
Obtener información sobre una transacción
Adicional a las notificaciones vía e-mail, Wompi te ofrece dos maneras a través de las cuales puedes obtener información completa sobre una transacción:

Activamente: haciendo una petición a nuestro API, por ejemplo al endpoint GET /v1/transactions/{ID_DE_TRANSACCION}.
Pasivamente: a través del evento transaction.updated. Para leer más sobre cómo funcionan los eventos en Wompi haz clic acá.
Seguimiento a una transacción con reintento
Para obtener la información sobre que es y como consultar una transacción con reintento, haz click aquí.

Eventos
Reintento de pagos
Notificaciones por correo
Cómo identificar una transacción
Estado de una transacción
Obtener información sobre una transacción
Seguimiento a una transacción con reintento

Inicio rápido.Widget & Checkout Web

Copyright © 2023 Wompi