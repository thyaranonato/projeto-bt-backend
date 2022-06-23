const express = require('express');
const app = express();
const cors = require('cors');
const pg = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const swaggerUi = require('swagger-ui-express');
const swaggerFile = require('./swagger_output.json');

app.use(express.json());
app.use(cors());
app.use('/doc', swaggerUi.serve, swaggerUi.setup(swaggerFile));

app.use(express.urlencoded({
  extended: false
}));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

app.get('/', (req, res) => {
  res.status(200).send({
    message: 'Servidor em execução!!'
  });
});

app.get('/criartabelatalentos', (req, res) => {
  pool.connect((err, client) => {
    if (err) {
      return res.status(401).send('Conexão não autorizada')
    }
    var sql = 'CREATE TABLE talentos (id SERIAL PRIMARY KEY NOT NULL, nome VARCHAR(20) NOT NULL, sobrenome VARCHAR(70) NOT NULL, fone VARCHAR(15) NOT NULL, email VARCHAR(50) NOT NULL, password VARCHAR(200) NOT NULL, profissao VARCHAR(60) NOT NULL, cidade VARCHAR(100) NOT NULL, estado VARCHAR(30) NOT NULL, imagem VARCHAR(500) NOT NULL, perfil VARCHAR(10))'
    client.query(sql, (error, result) => {
      if (error) {
        return res.status(401).send('Operação não autorizada')
      }
      res.status(200).send(result.rows)
      client.release()
    })
  })
})

app.get('/talentos', (req, res) => {
  pool.connect((err, client) => {
    if (err) {
      return res.status(401).send('Conexão não autorizada')
    }
    var sql = "SELECT t.*, a.area FROM TALENTOS t LEFT JOIN talento_areas ta ON t.id = ta.talentos_id LEFT JOIN areas a ON a.id = ta.areas_id ORDER BY a.area, t.nome;"
    client.query(sql, (error, result) => {
      if (error) {
        return res.status(401).send('Não autorizado')
      }
      res.status(200).send(result.rows)
      client.release()
    })
  })
});

app.get('/talentos/:id', (req, res) => {
  pool.connect((err, client) => {
    if (err) {
      return res.status(401).send("Conexão não autorizada")
    }
    var sql = "SELECT  t.*, a.id AS area_id, a.area FROM TALENTOS t INNER JOIN talento_areas ta ON t.id = ta.talentos_id LEFT JOIN areas a ON a.id = ta.areas_id WHERE t.id = $1"
    client.query(sql, [req.params.id], (error, result) => {
      if (error) {
        return res.status(401).send('Operação não autorizada')
      }
      res.status(200).send(result.rows[0])
      client.release()
    })
  })
});

app.post('/talentos/login', (req, res) => {
  pool.connect((err, client) => {
    if (err) {
      return res.status(401).send("Conexão não autorizada")
    }
    client.query('SELECT * FROM talentos WHERE email = $1', [req.body.email], (error, result) => {
      if (error) {
        return res.status(401).send('Operação não autorizada')
      }
      if (result.rowCount > 0) {
        bcrypt.compare(req.body.password, result.rows[0].password, (err, results) => {
          if (results) {
            let token = jwt.sign({
                id: result.rows[0].id,
                nome: result.rows[0].nome,
                sobrenome: result.rows[0].sobrenome,
                fone: result.rows[0].fone,
                email: result.rows[0].email,
                profissao: result.rows[0].profissao,
                cidade: result.rows[0].cidade,
                estado: result.rows[0].estado,
                imagem: result.rows[0].imagem,
                perfil: result.rows[0].perfil
              },
              process.env.JWTKEY, {
                expiresIn: '24h'
              })
            return res.status(200).send({
              token
            })
          } else {
            return res.status(401).send({message: "Falha na autenticação"})
          }
        })
        client.release()
      } else {
        return res.status(404).send({
          message: 'Usuário não encontrado'
        })
      }
    })
  })
});

app.post('/talentos', (req, res) => {
  pool.connect((err, client) => {
    if (err) {
      return res.status(401).send('Conexão não autorizada!');
    }
    client.query('SELECT * FROM talentos where email=$1', [req.body.email], (error, result) => {
      if (error) {
        return res.status(401).send('Não permitida');
      }
      if (result.rowCount > 0) {
        return res.status(208).send({ message: 'Email já existe!' });
      }
      bcrypt.hash(req.body.password, 10, (error, hash) => {
        if (error) {
          return res.status(500).send({
            mensagem: 'Erro de autenticação',
            erro: error.message
          });
        }
        var sql = 'INSERT INTO talentos (nome, sobrenome, fone, email, password, profissao, cidade, estado, imagem, perfil) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *'
        var dados = [req.body.nome, req.body.sobrenome, req.body.fone, req.body.email, hash, req.body.profissao, req.body.cidade, req.body.estado, req.body.imagem, 'talento'];
        client.query(sql, dados, (error, result2) => {
          if (error) {
            return res.status(401).send('Operação não permitida');
          } else {
            var sql = 'INSERT INTO talento_areas (talentos_id, areas_id) VALUES ($1, $2) RETURNING *'
            var dados = [result2.rows[0].id, req.body.areas];
            client.query(sql, dados, (error, result3) => {
              if (error) {
                return res.status(401).send('Operação não pode ser realizada');
              }
              res.status(201).send({
                message: 'Talento cadastrado com sucesso!!'
              });
              client.release()
            })
          };
        });
      });
    });
  });
});

/* app.put('/talentos/:id', (req, res) => {
  pool.connect((err, client) => {
    if (err) {
      return res.status(401).send("Conexão não autorizada")
    }
    var sql = 'SELECT * FROM talentos WHERE id=$1'
    client.query(sql, [req.params.id], (error, result) => {
      if (error) {
        return res.status(401).send('Não permitido')
      }
      if (result.rowCount > 0) {
        bcrypt.hash(req.body.password, 10, (error, hash) => {
          if (error) {
            return res.status(500).send({
              mensagem: 'Erro de autenticação',
              erro: error.message
            });
          }
          let sql = 'UPDATE talentos SET nome=$1, sobrenome=$2, fone=$3, email=$4, password=$5, profissao=$6, cidade=$7, estado=$8, imagem=$9 WHERE id=$10 RETURNING *'
          let dados = [req.body.nome, req.body.sobrenome, req.body.fone, req.body.email, hash, req.body.profissao, req.body.cidade, req.body.estado, req.body.imagem, req.params.id]
          client.query(sql, dados, (error2, result2) => {
            if (error2) {
              return res.status(401).send('Operação não permitida')
            } else {
              let sql = `UPDATE talento_areas SET areas_id=$1 WHERE talentos_id=$2 RETURNING *`
              let dados = [req.body.area_id, req.params.id]
              client.query(sql, dados, (error3, result3) => {
                if (error3) {
                  return res.status(401).send('Operação não pode ser realizada');
                } else {
                  return res.status(200).send({
                    message: 'Talento alterado com sucesso!',
                  })
                }
              });
              client.release()
            }
          })
        });
      } else {
        res.status(404).send('Talento não encontrado')
      }
    });
  });
}); */

app.put('/talentos/:id', (req, res) => {
  pool.connect((err, client) => {
    if (err) {
      return res.status(401).send("Conexão não autorizada")
    }
    var sql = 'SELECT * FROM talentos WHERE id=$1'
    client.query(sql, [req.params.id], (error, result) => {
      if (error) {
        return res.status(401).send('Não permitido')
      }
      if (result.rowCount > 0) {
          let sql = 'UPDATE talentos SET nome=$1, sobrenome=$2, fone=$3, email=$4, profissao=$5, cidade=$6, estado=$7, imagem=$8 WHERE id=$9 RETURNING *'
          let dados = [req.body.nome, req.body.sobrenome, req.body.fone, req.body.email, req.body.profissao, req.body.cidade, req.body.estado, req.body.imagem, req.params.id]
          client.query(sql, dados, (error2, result2) => {
            if (error2) {
              return res.status(401).send('Operação não permitida')
            } else {
              let sql = `UPDATE talento_areas SET areas_id=$1 WHERE talentos_id=$2 RETURNING *`
              let dados = [req.body.area_id, req.params.id]
              client.query(sql, dados, (error3, result3) => {
                if (error3) {
                  return res.status(401).send('Operação não pode ser realizada');
                } else {
                  return res.status(200).send({
                    message: 'Talento alterado com sucesso!',
                  })
                }
              });
              client.release()
            }
          })
      } else {
        res.status(404).send('Talento não encontrado')
      }
    });
  });
});

app.delete('/talentos/:id', (req, res) => {
  pool.connect((err, client) => {
    if (err) {
      res.status(401).send("Conexão não autorizada")
    }
    client.query('DELETE FROM talento_areas WHERE talentos_id=$1', [req.params.id], (error, result) => {
      if (error) {
        return res.status(401).send({
          msg: "Operação não autorizada",
          error
        })
      } else {
        client.query('DELETE FROM talentos WHERE id=$1', [req.params.id], (error, result2) => {
          if (error) {
            return res.status(401).send("Operação 2 não autorizada")
          }
          res.status(200).send("Excluído com sucesso")
          client.release()
        })
      }
    })
  })
})

app.get('/areas', (req, res) => {
  pool.connect((err, client) => {
    if (err) {
      return res.status(401).send('Conexão não autorizada')
    }
    client.query('SELECT * FROM areas', (error, result) => {
      if (error) {
        return res.status(401).send('Não autorizado')
      }
      res.status(200).send(result.rows)
      client.release()
    })
  })
});

app.get('/areas/:id', (req, res) => {
  pool.connect((err, client) => {
    if (err) {
      return res.status(401).send("Conexão não autorizada")
    }
    client.query('SELECT * FROM areas WHERE id = $1', [req.params.id], (error, result) => {
      if (error) {
        return res.status(401).send('Operação não autorizada')
      }
      res.status(200).send(result.rows[0])
      client.release()
    })
  })
});

app.post('/areas', (req, res) => {
  pool.connect((err, client) => {
    if (err) {
      return res.status(401).send('Conexão não autorizada!');
    }
    client.query('SELECT * FROM areas where area=$1', [req.body.area], async (error, result) => {
      if (error) {
        return res.status(401).send('Não permitida');
      }
      if (result.rowCount > 0) {
        return res.status(208).send('Área já existe!');
      }
      var sql = 'INSERT INTO areas(area) VALUES ($1) RETURNING *';
      var dados = [req.body.area];
      client.query(sql, dados, function (error, resultado) {
        if (error) {
          return res.status(401).send('Operação não permitida');
        }
        res.status(201).send({
          message: 'Área cadastrada com sucesso!!',

        });
        client.release()
      });
    });
  });
});

app.put('/areas/:id', (req, res) => {
  pool.connect((err, client) => {
    if (err) {
      return res.status(401).send("Conexão não autorizada")
    }
    var sql = 'SELECT * FROM areas WHERE id=$1'
    client.query(sql, [req.params.id], (error, result) => {
      if (error) {
        return res.status(401).send('Não permitido')
      }
      if (result.rowCount > 0) {
        let sql = 'UPDATE areas SET area=$1 WHERE id=$2'
        let dados = [req.body.area, req.params.id]
        client.query(sql, dados, (error2, result2) => {
          if (error2) {
            return res.status(401).send('Operação não permitida')
          }
          if (result2.rowCount > 0) {
            return res.status(200).send({
              message: 'Área alterada com sucesso!'
            })
          }
          client.release()
        })
      } else {
        res.status(404).send('Área não encontrada')
      }
    })
  })
});

app.delete('/areas/:id', (req, res) => {
  pool.connect((err, client) => {
    if (err) {
      res.status(401).send("Conexão não autorizada")
    }

    client.query('DELETE FROM areas WHERE id=$1', [req.params.id], (error, result) => {
      if (error) {
        return res.status(401).send("Operação não autorizada")
      }
      res.status(200).send("Excluído com sucesso")
      client.release()
    })
  })
})

app.listen(process.env.PORT || 8080, () => console.log('Aplicação em execução na PORTA 8080'))