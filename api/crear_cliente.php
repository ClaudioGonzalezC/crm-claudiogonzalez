<?php
header("Cache-Control: no-cache, no-store, must-revalidate");
header("Pragma: no-cache");
header("Expires: 0");
header('Content-Type: application/json');

include_once '../config/config.php';

date_default_timezone_set('America/Santiago');

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->nombre_empresa)) {
    try {
        $query = "INSERT INTO clientes
                  SET nombre_empresa     = :nombre_empresa,
                      nombre_contacto   = :nombre_contacto,
                      email             = :email,
                      industria         = :industria,
                      tamano_empresa    = :tamano_empresa,
                      presupuesto_estimado = :presupuesto_estimado,
                      objetivo_proyecto = :objetivo_proyecto,
                      competidores      = :competidores,
                      referencias       = :referencias,
                      fecha_creacion    = :fecha_creacion";

        $stmt = $conn->prepare($query);
        $stmt->bindParam(":nombre_empresa",      $data->nombre_empresa);
        $stmt->bindParam(":nombre_contacto",     $data->nombre_contacto);
        $stmt->bindParam(":email",               $data->email);
        $stmt->bindParam(":industria",           $data->industria);
        $stmt->bindParam(":tamano_empresa",      $data->tamano_empresa);
        $stmt->bindParam(":presupuesto_estimado",$data->presupuesto_estimado);
        $stmt->bindParam(":objetivo_proyecto",   $data->objetivo_proyecto);
        $stmt->bindParam(":competidores",        $data->competidores);
        $stmt->bindParam(":referencias",         $data->referencias);

        $fecha_santiago = date('Y-m-d H:i:s'); // TZ ya seteada arriba
        $stmt->bindParam(":fecha_creacion", $fecha_santiago);

        if ($stmt->execute()) {
            http_response_code(201);
            echo json_encode([
                "message" => "Cliente creado con éxito.",
                "id"      => $conn->lastInsertId(),
            ]);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["error" => "No se pudo crear el cliente: " . $e->getMessage()]);
    }
} else {
    http_response_code(400);
    echo json_encode(["message" => "Datos incompletos. El nombre de la empresa es obligatorio."]);
}
?>