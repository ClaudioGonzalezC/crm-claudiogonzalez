<?php
include_once '../config/config.php';
header('Content-Type: application/json');

// Capturamos la entrada de Builder
$data = json_decode(file_get_contents("php://input"), true);
$operacion = $data['operacion'] ?? '';

try {
    switch($operacion) {
        case 'listar':
            // Obtenemos a todos para que Claudio pueda gestionarlos
            $stmt = $conn->query("SELECT id, nombre, usuario, rol, ultimo_login FROM usuarios ORDER BY id DESC");
            $usuarios = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Casteo de tipos para asegurar compatibilidad con React
            foreach ($usuarios as &$u) {
                $u['id'] = (int)$u['id'];
            }
            echo json_encode($usuarios);
            break;

        case 'crear':
            if (empty($data['usuario']) || empty($data['password'])) {
                throw new Exception("Usuario y contraseña son obligatorios.");
            }
            $pass = password_hash($data['password'], PASSWORD_BCRYPT);
            $rol = $data['rol'] ?? 'colaborador';
            
            $stmt = $conn->prepare("INSERT INTO usuarios (nombre, usuario, password, rol) VALUES (?, ?, ?, ?)");
            $stmt->execute([$data['nombre'], $data['usuario'], $pass, $rol]);
            
            echo json_encode(["status" => "success", "message" => "Usuario creado exitosamente"]);
            break;

        case 'obtener':
            $id = (int)($data['usuario_id'] ?? 0);
            $stmt = $conn->prepare("SELECT id, nombre, usuario, rol FROM usuarios WHERE id = ?");
            $stmt->execute([$id]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($user) {
                $user['id'] = (int)$user['id'];
                echo json_encode($user);
            } else {
                http_response_code(404);
                echo json_encode(["status" => "error", "message" => "Usuario no encontrado"]);
            }
            break;

        case 'actualizar':
        case 'editar':
            $id = (int)($data['usuario_id'] ?? 0);
            $nombre = $data['nombre'] ?? null;
            $usuario = $data['usuario'] ?? null;
            $rol = $data['rol'] ?? null;
            
            // Regla de Seguridad: Nadie, ni siquiera otro admin, puede quitarle el rol admin al ID 6 (Claudio)
            if ($id === 6 && $rol !== 'admin' && !empty($rol)) {
                $rol = 'admin'; 
            }

            if (!empty($data['password'])) {
                // RESET DE CONTRASEÑA (ADMINISTRATIVO O PERFIL)
                $pass = password_hash($data['password'], PASSWORD_BCRYPT);
                
                if ($nombre) {
                    // Actualización completa (desde Ajustes o Perfil)
                    $stmt = $conn->prepare("UPDATE usuarios SET nombre=?, usuario=?, password=?, rol=? WHERE id=?");
                    $stmt->execute([$nombre, $usuario, $pass, $rol, $id]);
                } else {
                    // Reset rápido de clave desde Gestión de Equipo
                    $stmt = $conn->prepare("UPDATE usuarios SET password=?, rol=? WHERE id=?");
                    $stmt->execute([$pass, $rol, $id]);
                }
            } else {
                // ACTUALIZACIÓN SIN CAMBIO DE CLAVE
                if ($nombre) {
                    $stmt = $conn->prepare("UPDATE usuarios SET nombre=?, usuario=?, rol=? WHERE id=?");
                    $stmt->execute([$nombre, $usuario, $rol, $id]);
                } else {
                    $stmt = $conn->prepare("UPDATE usuarios SET rol=? WHERE id=?");
                    $stmt->execute([$rol, $id]);
                }
            }
            echo json_encode(["status" => "success", "message" => "Usuario actualizado correctamente"]);
            break;

        case 'eliminar':
            $id = (int)($data['usuario_id'] ?? 0);
            
            // BLOQUEO DE SEGURIDAD ABSOLUTO: El ID 6 es intocable.
            if ($id === 6) {
                throw new Exception("El administrador principal no puede ser eliminado.");
            }

            // Solo se elimina si no es un admin (doble check)
            $stmt = $conn->prepare("DELETE FROM usuarios WHERE id = ? AND rol != 'admin'");
            $stmt->execute([$id]);
            
            if ($stmt->rowCount() > 0) {
                echo json_encode(["status" => "success", "message" => "Usuario eliminado"]);
            } else {
                throw new Exception("No se pudo eliminar el usuario (puede que sea admin o no exista).");
            }
            break;

        default:
            throw new Exception("Operación no válida: " . $operacion);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}