// Simple XSD definition for DSL XML representation
// Consumers can copy this XSD string and use standard XML validators
export const DSL_XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" elementFormDefault="qualified" attributeFormDefault="unqualified">
  <xs:simpleType name="Operator">
    <xs:restriction base="xs:string">
      <xs:enumeration value=">"/>
      <xs:enumeration value="<"/>
      <xs:enumeration value="="/>
      <xs:enumeration value=">="/>
      <xs:enumeration value="<="/>
    </xs:restriction>
  </xs:simpleType>

  <xs:simpleType name="ElseType">
    <xs:restriction base="xs:string">
      <xs:enumeration value="ERROR"/>
      <xs:enumeration value="WARNING"/>
      <xs:enumeration value="INFO"/>
      <xs:enumeration value="GOAL"/>
    </xs:restriction>
  </xs:simpleType>

  <xs:element name="dsl">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="goal" minOccurs="1" maxOccurs="unbounded">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="steps">
                <xs:complexType>
                  <xs:choice minOccurs="1" maxOccurs="unbounded">
                    <xs:element name="task">
                      <xs:complexType>
                        <xs:sequence>
                          <xs:element name="action" minOccurs="1" maxOccurs="1">
                            <xs:complexType>
                              <xs:attribute name="function" type="xs:string" use="required"/>
                              <xs:attribute name="object" type="xs:string" use="required"/>
                            </xs:complexType>
                          </xs:element>
                          <xs:element name="and" minOccurs="0" maxOccurs="unbounded">
                            <xs:complexType>
                              <xs:attribute name="function" type="xs:string" use="required"/>
                              <xs:attribute name="object" type="xs:string" use="required"/>
                            </xs:complexType>
                          </xs:element>
                        </xs:sequence>
                      </xs:complexType>
                    </xs:element>
                    <xs:element name="if">
                      <xs:complexType>
                        <xs:attribute name="parameter" type="xs:string" use="required"/>
                        <xs:attribute name="operator" type="Operator" use="required"/>
                        <xs:attribute name="value" type="xs:string" use="required"/>
                      </xs:complexType>
                    </xs:element>
                    <xs:element name="else">
                      <xs:complexType>
                        <xs:attribute name="actionType" type="ElseType" use="required"/>
                        <xs:attribute name="actionMessage" type="xs:string" use="required"/>
                      </xs:complexType>
                    </xs:element>
                    <xs:element name="get">
                      <xs:complexType>
                        <xs:attribute name="parameter" type="xs:string" use="required"/>
                        <xs:attribute name="unit" type="xs:string" use="optional"/>
                      </xs:complexType>
                    </xs:element>
                    <xs:element name="set">
                      <xs:complexType>
                        <xs:attribute name="parameter" type="xs:string" use="required"/>
                        <xs:attribute name="value" type="xs:string" use="required"/>
                        <xs:attribute name="unit" type="xs:string" use="optional"/>
                      </xs:complexType>
                    </xs:element>
                    <xs:element name="max">
                      <xs:complexType>
                        <xs:attribute name="parameter" type="xs:string" use="required"/>
                        <xs:attribute name="value" type="xs:string" use="required"/>
                        <xs:attribute name="unit" type="xs:string" use="optional"/>
                      </xs:complexType>
                    </xs:element>
                    <xs:element name="min">
                      <xs:complexType>
                        <xs:attribute name="parameter" type="xs:string" use="required"/>
                        <xs:attribute name="value" type="xs:string" use="required"/>
                        <xs:attribute name="unit" type="xs:string" use="optional"/>
                      </xs:complexType>
                    </xs:element>
                  </xs:choice>
                </xs:complexType>
              </xs:element>
            </xs:sequence>
            <xs:attribute name="name" type="xs:string" use="required"/>
          </xs:complexType>
        </xs:element>
      </xs:sequence>
      <xs:attribute name="scenario" type="xs:string" use="required"/>
    </xs:complexType>
  </xs:element>
</xs:schema>
`;
