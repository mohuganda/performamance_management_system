package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"goravel/app/facades"
)

type backupDBConfig struct {
	Engine   string
	Host     string
	Port     string
	Database string
	Username string
	Password string
}

func loadBackupDBConfig() backupDBConfig {
	engine := strings.ToLower(strings.TrimSpace(facades.Config().GetString("database.default")))
	if engine == "" {
		engine = strings.ToLower(strings.TrimSpace(os.Getenv("DB_CONNECTION")))
	}
	if engine != "mysql" {
		engine = "postgres"
	}
	host := castString(facades.Config().Env("DB_HOST", "127.0.0.1"))
	port := castString(facades.Config().Env("DB_PORT", ""))
	if port == "" {
		if engine == "mysql" {
			port = "3306"
		} else {
			port = "5432"
		}
	}
	db := castString(facades.Config().Env("DB_DATABASE", "moh_pms"))
	user := castString(facades.Config().Env("DB_USERNAME", "pms"))
	pass := castString(facades.Config().Env("DB_PASSWORD", ""))
	return backupDBConfig{
		Engine:   engine,
		Host:     host,
		Port:     port,
		Database: db,
		Username: user,
		Password: pass,
	}
}

func backupUseDockerExec() bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("DB_BACKUP_USE_DOCKER_EXEC")))
	return v == "1" || v == "true" || v == "yes"
}

func dockerDBContainer(engine string) string {
	if engine == "mysql" {
		if n := strings.TrimSpace(os.Getenv("DB_BACKUP_MYSQL_CONTAINER")); n != "" {
			return n
		}
		return "moh-pms-mysql"
	}
	if n := strings.TrimSpace(os.Getenv("DB_BACKUP_POSTGRES_CONTAINER")); n != "" {
		return n
	}
	return "moh-pms-postgres"
}

// dumpPrimaryToGzipFile writes a gzipped SQL dump of the primary engine to destPath.
func dumpPrimaryToGzipFile(destPath string) error {
	cfg := loadBackupDBConfig()
	if err := os.MkdirAll(filepath.Dir(destPath), 0o755); err != nil {
		return err
	}
	tmp := destPath + ".partial"
	_ = os.Remove(tmp)
	defer func() { _ = os.Remove(tmp) }()

	var cmd *exec.Cmd
	if backupUseDockerExec() {
		container := dockerDBContainer(cfg.Engine)
		if cfg.Engine == "mysql" {
			inner := fmt.Sprintf(
				`mysqldump -u%q -p%q --single-transaction --routines --triggers %q | gzip -c`,
				cfg.Username, cfg.Password, cfg.Database,
			)
			cmd = exec.Command("docker", "exec", container, "sh", "-c", inner)
		} else {
			inner := fmt.Sprintf(
				`PGPASSWORD=%q pg_dump -U %q -d %q --no-owner --no-acl | gzip -c`,
				cfg.Password, cfg.Username, cfg.Database,
			)
			cmd = exec.Command("docker", "exec", container, "sh", "-c", inner)
		}
	} else if cfg.Engine == "mysql" {
		dump := exec.Command(
			"mysqldump",
			"-h", cfg.Host,
			"-P", cfg.Port,
			"-u", cfg.Username,
			"--single-transaction",
			"--routines",
			"--triggers",
			cfg.Database,
		)
		dump.Env = append(os.Environ(), "MYSQL_PWD="+cfg.Password)
		gzipCmd := exec.Command("gzip", "-c")
		var err error
		gzipCmd.Stdin, err = dump.StdoutPipe()
		if err != nil {
			return err
		}
		out, err := os.Create(tmp)
		if err != nil {
			return err
		}
		gzipCmd.Stdout = out
		gzipCmd.Stderr = os.Stderr
		dump.Stderr = os.Stderr
		if err := gzipCmd.Start(); err != nil {
			_ = out.Close()
			return err
		}
		if err := dump.Run(); err != nil {
			_ = gzipCmd.Process.Kill()
			_ = out.Close()
			return fmt.Errorf("mysqldump failed: %w", err)
		}
		if err := gzipCmd.Wait(); err != nil {
			_ = out.Close()
			return fmt.Errorf("gzip failed: %w", err)
		}
		if err := out.Close(); err != nil {
			return err
		}
		return os.Rename(tmp, destPath)
	} else {
		dump := exec.Command(
			"pg_dump",
			"-h", cfg.Host,
			"-p", cfg.Port,
			"-U", cfg.Username,
			"-d", cfg.Database,
			"--no-owner",
			"--no-acl",
		)
		dump.Env = append(os.Environ(), "PGPASSWORD="+cfg.Password)
		gzipCmd := exec.Command("gzip", "-c")
		var err error
		gzipCmd.Stdin, err = dump.StdoutPipe()
		if err != nil {
			return err
		}
		out, err := os.Create(tmp)
		if err != nil {
			return err
		}
		gzipCmd.Stdout = out
		gzipCmd.Stderr = os.Stderr
		dump.Stderr = os.Stderr
		if err := gzipCmd.Start(); err != nil {
			_ = out.Close()
			return err
		}
		if err := dump.Run(); err != nil {
			_ = gzipCmd.Process.Kill()
			_ = out.Close()
			return fmt.Errorf("pg_dump failed: %w", err)
		}
		if err := gzipCmd.Wait(); err != nil {
			_ = out.Close()
			return fmt.Errorf("gzip failed: %w", err)
		}
		if err := out.Close(); err != nil {
			return err
		}
		return os.Rename(tmp, destPath)
	}

	out, err := os.Create(tmp)
	if err != nil {
		return err
	}
	cmd.Stdout = out
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		_ = out.Close()
		return fmt.Errorf("dump failed: %w", err)
	}
	if err := out.Close(); err != nil {
		return err
	}
	return os.Rename(tmp, destPath)
}

func restoreGzipFileToDatabase(srcPath, targetDB string) error {
	cfg := loadBackupDBConfig()
	if backupUseDockerExec() {
		container := dockerDBContainer(cfg.Engine)
		// Stream host file into container via docker exec -i
		f, err := os.Open(srcPath)
		if err != nil {
			return err
		}
		defer f.Close()
		var cmd *exec.Cmd
		if cfg.Engine == "mysql" {
			inner := fmt.Sprintf(`gunzip -c | mysql -u%q -p%q %q`, cfg.Username, cfg.Password, targetDB)
			cmd = exec.Command("docker", "exec", "-i", container, "sh", "-c", inner)
		} else {
			inner := fmt.Sprintf(`gunzip -c | PGPASSWORD=%q psql -U %q -d %q -v ON_ERROR_STOP=1`, cfg.Password, cfg.Username, targetDB)
			cmd = exec.Command("docker", "exec", "-i", container, "sh", "-c", inner)
		}
		cmd.Stdin = f
		cmd.Stderr = os.Stderr
		return cmd.Run()
	}

	gunzip := exec.Command("gunzip", "-c", srcPath)
	stdout, err := gunzip.StdoutPipe()
	if err != nil {
		return err
	}
	gunzip.Stderr = os.Stderr
	var client *exec.Cmd
	if cfg.Engine == "mysql" {
		client = exec.Command("mysql", "-h", cfg.Host, "-P", cfg.Port, "-u", cfg.Username, targetDB)
		client.Env = append(os.Environ(), "MYSQL_PWD="+cfg.Password)
	} else {
		client = exec.Command("psql", "-h", cfg.Host, "-p", cfg.Port, "-U", cfg.Username, "-d", targetDB, "-v", "ON_ERROR_STOP=1")
		client.Env = append(os.Environ(), "PGPASSWORD="+cfg.Password)
	}
	client.Stdin = stdout
	client.Stderr = os.Stderr
	if err := gunzip.Start(); err != nil {
		return err
	}
	if err := client.Run(); err != nil {
		_ = gunzip.Process.Kill()
		return fmt.Errorf("restore client failed: %w", err)
	}
	return gunzip.Wait()
}

func createDatabase(name string) error {
	cfg := loadBackupDBConfig()
	if backupUseDockerExec() {
		container := dockerDBContainer(cfg.Engine)
		var cmd *exec.Cmd
		if cfg.Engine == "mysql" {
			inner := fmt.Sprintf(`mysql -u%q -p%q -e %q`, cfg.Username, cfg.Password, "CREATE DATABASE IF NOT EXISTS `"+name+"`")
			cmd = exec.Command("docker", "exec", container, "sh", "-c", inner)
		} else {
			// ignore error if exists
			inner := fmt.Sprintf(`PGPASSWORD=%q psql -U %q -d postgres -c %q`, cfg.Password, cfg.Username, "CREATE DATABASE "+name)
			cmd = exec.Command("docker", "exec", container, "sh", "-c", inner)
		}
		_ = cmd.Run()
		return nil
	}
	if cfg.Engine == "mysql" {
		cmd := exec.Command("mysql", "-h", cfg.Host, "-P", cfg.Port, "-u", cfg.Username, "-e", "CREATE DATABASE IF NOT EXISTS `"+name+"`")
		cmd.Env = append(os.Environ(), "MYSQL_PWD="+cfg.Password)
		return cmd.Run()
	}
	cmd := exec.Command("psql", "-h", cfg.Host, "-p", cfg.Port, "-U", cfg.Username, "-d", "postgres", "-c", "CREATE DATABASE "+name)
	cmd.Env = append(os.Environ(), "PGPASSWORD="+cfg.Password)
	out, err := cmd.CombinedOutput()
	if err != nil && !strings.Contains(string(out), "already exists") {
		return fmt.Errorf("create database: %w (%s)", err, strings.TrimSpace(string(out)))
	}
	return nil
}

func dropDatabase(name string) error {
	cfg := loadBackupDBConfig()
	if name == "" || name == cfg.Database {
		return fmt.Errorf("refusing to drop primary database")
	}
	if backupUseDockerExec() {
		container := dockerDBContainer(cfg.Engine)
		var cmd *exec.Cmd
		if cfg.Engine == "mysql" {
			inner := fmt.Sprintf(`mysql -u%q -p%q -e %q`, cfg.Username, cfg.Password, "DROP DATABASE IF EXISTS `"+name+"`")
			cmd = exec.Command("docker", "exec", container, "sh", "-c", inner)
		} else {
			inner := fmt.Sprintf(
				`PGPASSWORD=%q psql -U %q -d postgres -c %q`,
				cfg.Password, cfg.Username,
				"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '"+name+"'; DROP DATABASE IF EXISTS "+name,
			)
			cmd = exec.Command("docker", "exec", container, "sh", "-c", inner)
		}
		return cmd.Run()
	}
	if cfg.Engine == "mysql" {
		cmd := exec.Command("mysql", "-h", cfg.Host, "-P", cfg.Port, "-u", cfg.Username, "-e", "DROP DATABASE IF EXISTS `"+name+"`")
		cmd.Env = append(os.Environ(), "MYSQL_PWD="+cfg.Password)
		return cmd.Run()
	}
	term := exec.Command("psql", "-h", cfg.Host, "-p", cfg.Port, "-U", cfg.Username, "-d", "postgres", "-c",
		"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '"+name+"'")
	term.Env = append(os.Environ(), "PGPASSWORD="+cfg.Password)
	_ = term.Run()
	cmd := exec.Command("psql", "-h", cfg.Host, "-p", cfg.Port, "-U", cfg.Username, "-d", "postgres", "-c", "DROP DATABASE IF EXISTS "+name)
	cmd.Env = append(os.Environ(), "PGPASSWORD="+cfg.Password)
	return cmd.Run()
}

func healthCheckDatabase(name string) error {
	cfg := loadBackupDBConfig()
	query := "SELECT 1"
	if backupUseDockerExec() {
		container := dockerDBContainer(cfg.Engine)
		var cmd *exec.Cmd
		if cfg.Engine == "mysql" {
			inner := fmt.Sprintf(`mysql -u%q -p%q -N -e %q %q`, cfg.Username, cfg.Password, query, name)
			cmd = exec.Command("docker", "exec", container, "sh", "-c", inner)
		} else {
			inner := fmt.Sprintf(`PGPASSWORD=%q psql -U %q -d %q -tAc %q`, cfg.Password, cfg.Username, name, query)
			cmd = exec.Command("docker", "exec", container, "sh", "-c", inner)
		}
		out, err := cmd.CombinedOutput()
		if err != nil {
			return fmt.Errorf("health check failed: %w (%s)", err, strings.TrimSpace(string(out)))
		}
		return nil
	}
	if cfg.Engine == "mysql" {
		cmd := exec.Command("mysql", "-h", cfg.Host, "-P", cfg.Port, "-u", cfg.Username, "-N", "-e", query, name)
		cmd.Env = append(os.Environ(), "MYSQL_PWD="+cfg.Password)
		out, err := cmd.CombinedOutput()
		if err != nil {
			return fmt.Errorf("health check failed: %w (%s)", err, strings.TrimSpace(string(out)))
		}
		return nil
	}
	cmd := exec.Command("psql", "-h", cfg.Host, "-p", cfg.Port, "-U", cfg.Username, "-d", name, "-tAc", query)
	cmd.Env = append(os.Environ(), "PGPASSWORD="+cfg.Password)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("health check failed: %w (%s)", err, strings.TrimSpace(string(out)))
	}
	_ = strconv.Itoa(len(out))
	return nil
}
