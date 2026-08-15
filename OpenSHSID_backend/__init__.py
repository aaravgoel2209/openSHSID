"""OpenSHSID_backend 包根。

数据库驱动：MySQL 模式用 PyMySQL 充当 MySQLdb（Django 的 mysql 后端按
``import MySQLdb`` 加载），纯 Python 实现，Windows / Docker slim 均无需
系统级 mysqlclient C 库。SQLite 模式不受影响。
"""
import pymysql

pymysql.install_as_MySQLdb()
