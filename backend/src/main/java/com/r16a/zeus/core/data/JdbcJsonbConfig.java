package com.r16a.zeus.core.data;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.postgresql.util.PGobject;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.jdbc.core.mapping.JdbcValue;
import org.springframework.data.jdbc.core.convert.JdbcCustomConversions;
import org.springframework.data.convert.ReadingConverter;
import org.springframework.data.convert.WritingConverter;

import java.sql.JDBCType;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;

@Configuration
public class JdbcJsonbConfig {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Bean
    public JdbcCustomConversions jdbcCustomConversions() {
        return new JdbcCustomConversions(List.of(
                new MapToJsonbConverter(),
                new JsonbToMapConverter(),
                new StringToMapConverter()
        ));
    }

    @WritingConverter
    static class MapToJsonbConverter implements Converter<Map<String, String>, JdbcValue> {
        @Override
        public JdbcValue convert(Map<String, String> source) {
            PGobject target = new PGobject();
            target.setType("jsonb");
            try {
                target.setValue(OBJECT_MAPPER.writeValueAsString(source));
            } catch (JsonProcessingException | SQLException exception) {
                throw new IllegalArgumentException("Failed to serialize voltage level colors.", exception);
            }
            return JdbcValue.of(target, JDBCType.OTHER);
        }
    }

    @ReadingConverter
    static class JsonbToMapConverter implements Converter<PGobject, Map<String, String>> {
        private static final TypeReference<Map<String, String>> MAP_TYPE = new TypeReference<>() {
        };

        @Override
        public Map<String, String> convert(PGobject source) {
            String value = source.getValue();
            if (value == null || value.isBlank()) {
                return Map.of();
            }
            try {
                return OBJECT_MAPPER.readValue(value, MAP_TYPE);
            } catch (JsonProcessingException exception) {
                throw new IllegalArgumentException("Failed to deserialize voltage level colors.", exception);
            }
        }
    }

    @ReadingConverter
    static class StringToMapConverter implements Converter<String, Map<String, String>> {
        private static final TypeReference<Map<String, String>> MAP_TYPE = new TypeReference<>() {
        };

        @Override
        public Map<String, String> convert(String source) {
            if (source.isBlank()) {
                return Map.of();
            }
            try {
                return OBJECT_MAPPER.readValue(source, MAP_TYPE);
            } catch (JsonProcessingException exception) {
                throw new IllegalArgumentException("Failed to deserialize voltage level colors.", exception);
            }
        }
    }
}
