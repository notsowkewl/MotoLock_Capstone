# coding=utf-8
import os

output_dir = 'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/data'
os.makedirs(output_dir, exist_ok=True)

db_kt = """package com.example.motolock.data

import androidx.room.*

@Entity(tableName = "motorcycles")
data class MotorcycleEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val brand: String,
    val isDefault: Boolean = false
)

@Dao
interface MotorcycleDao {
    @Query("SELECT * FROM motorcycles")
    suspend fun getAll(): List<MotorcycleEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(motorcycle: MotorcycleEntity)
}

@Database(entities = [MotorcycleEntity::class], version = 1)
abstract class AppDatabase : RoomDatabase() {
    abstract fun motorcycleDao(): MotorcycleDao
}
"""

with open(os.path.join(output_dir, "AppDatabase.kt"), "w", encoding="utf-8") as f:
    f.write(db_kt)
print("Database code created")
