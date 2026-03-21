<?php
include_once '../config/config.php';

// Aceptar tanto PUT como POST para mayor compatibilidad con Builder.io
$data = json_decode(file_get_contents("php://input"));

if (!empty($data->id) && !empty($data->nombre_empresa)) {
    try {
        $query = "UPDATE clientes SET 
                    nombre_empresa = :ne, 
                    nombre_contacto = :nc, 
                    email = :em, 
                    industria = :in, 
                    tamano_empresa = :te,
                    presupuesto_estimado = :pe,
                    objetivo_proyecto = :op,
                    competidores = :co,
                    referencias = :re
                  WHERE id = :id";

        $stmt = $conn->prepare($query);
        $stmt->execute([
            ":ne" => $data->nombre_empresa,
            ":nc" => $data->nombre_contacto,
            ":em" => $data->email,
            ":in" => $data->industria,
            ":te" => $data->tamano_empresa,
            ":pe" => $data->presupuesto_estimado,
            ":op" => $data->objetivo_proyecto,
            ":co" => $data->competidores,
            ":re" => $data->referencias,
            ":id" => $data->id
        ]);

        echo json_encode(["status" => "success", "message" => "Cliente actualizado correctamente"]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
} else {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "ID y Nombre de Empresa son obligatorios"]);
}
?>