"""Storage-related Kubernetes operations (PVCs, PVs, StorageClasses)."""

import logging
from typing import List, Optional

from kubernetes import client
from kubernetes.client.rest import ApiException

from app.services.kubernetes.base import KubernetesBase
from app.schemas.kubernetes import (
    PVCInfo,
    PVInfo,
    StorageClassInfo,
    PVCCreateRequest,
    PVCUpdateRequest,
    PVCreateRequest,
    StorageClassCreateRequest,
    ResourceDeleteResponse,
)

logger = logging.getLogger(__name__)


class StorageService(KubernetesBase):
    """Service for Storage-related operations."""

    async def get_pvcs(self, namespace: Optional[str] = None) -> List[PVCInfo]:
        """Get all PersistentVolumeClaims."""
        try:
            if namespace:
                pvcs = self.core_v1.list_namespaced_persistent_volume_claim(namespace)
            else:
                pvcs = self.core_v1.list_persistent_volume_claim_for_all_namespaces()

            result = []
            for pvc in pvcs.items:
                result.append(
                    PVCInfo(
                        name=pvc.metadata.name,
                        namespace=pvc.metadata.namespace,
                        status=pvc.status.phase,
                        volume=pvc.spec.volume_name,
                        capacity=pvc.status.capacity.get("storage")
                        if pvc.status.capacity
                        else None,
                        access_modes=pvc.spec.access_modes or [],
                        storage_class=pvc.spec.storage_class_name,
                        age=self.calculate_age(pvc.metadata.creation_timestamp),
                    )
                )
            return result
        except ApiException as e:
            logger.error(f"Error listing PVCs: {e}")
            raise

    async def create_pvc(self, request: PVCCreateRequest) -> PVCInfo:
        """Create a PersistentVolumeClaim."""
        try:
            pvc = client.V1PersistentVolumeClaim(
                metadata=client.V1ObjectMeta(
                    name=request.name,
                    namespace=request.namespace,
                    labels=request.labels or None,
                ),
                spec=client.V1PersistentVolumeClaimSpec(
                    access_modes=request.access_modes,
                    storage_class_name=request.storage_class,
                    resources=client.V1ResourceRequirements(
                        requests={"storage": request.storage}
                    ),
                ),
            )

            created = self.core_v1.create_namespaced_persistent_volume_claim(
                request.namespace, pvc
            )

            return PVCInfo(
                name=created.metadata.name,
                namespace=created.metadata.namespace,
                status=created.status.phase if created.status else "Pending",
                volume=created.spec.volume_name,
                capacity=None,
                access_modes=created.spec.access_modes or [],
                storage_class=created.spec.storage_class_name,
                age=self.calculate_age(created.metadata.creation_timestamp),
            )
        except ApiException as e:
            logger.error(f"Error creating PVC: {e}")
            raise

    async def update_pvc(
        self, namespace: str, name: str, request: PVCUpdateRequest
    ) -> PVCInfo:
        """Update a PersistentVolumeClaim."""
        try:
            current = self.core_v1.read_namespaced_persistent_volume_claim(
                name, namespace
            )

            if request.labels is not None:
                current.metadata.labels = request.labels

            updated = self.core_v1.replace_namespaced_persistent_volume_claim(
                name, namespace, current
            )

            return PVCInfo(
                name=updated.metadata.name,
                namespace=updated.metadata.namespace,
                status=updated.status.phase if updated.status else "Unknown",
                volume=updated.spec.volume_name,
                capacity=updated.status.capacity.get("storage")
                if updated.status and updated.status.capacity
                else None,
                access_modes=updated.spec.access_modes or [],
                storage_class=updated.spec.storage_class_name,
                age=self.calculate_age(updated.metadata.creation_timestamp),
            )
        except ApiException as e:
            logger.error(f"Error updating PVC: {e}")
            raise

    async def delete_pvc(self, namespace: str, name: str) -> ResourceDeleteResponse:
        """Delete a PersistentVolumeClaim."""
        try:
            self.core_v1.delete_namespaced_persistent_volume_claim(name, namespace)
            return ResourceDeleteResponse(
                success=True, message=f"PVC {name} deleted successfully"
            )
        except ApiException as e:
            logger.error(f"Error deleting PVC: {e}")
            raise

    async def get_pvs(self) -> List[PVInfo]:
        """Get all PersistentVolumes."""
        try:
            pvs = self.core_v1.list_persistent_volume()
            result = []
            for pv in pvs.items:
                result.append(
                    PVInfo(
                        name=pv.metadata.name,
                        status=pv.status.phase if pv.status else "Unknown",
                        capacity=pv.spec.capacity.get("storage")
                        if pv.spec.capacity
                        else None,
                        access_modes=pv.spec.access_modes or [],
                        storage_class=pv.spec.storage_class_name,
                        reclaim_policy=pv.spec.persistent_volume_reclaim_policy,
                        claim=f"{pv.spec.claim_ref.namespace}/{pv.spec.claim_ref.name}"
                        if pv.spec.claim_ref
                        else None,
                        age=self.calculate_age(pv.metadata.creation_timestamp),
                    )
                )
            return result
        except ApiException as e:
            logger.error(f"Error listing PVs: {e}")
            raise

    async def create_pv(self, request: PVCreateRequest) -> PVInfo:
        """Create a PersistentVolume."""
        try:
            pv_spec = client.V1PersistentVolumeSpec(
                capacity={"storage": request.capacity},
                access_modes=request.access_modes,
                storage_class_name=request.storage_class,
                persistent_volume_reclaim_policy=request.reclaim_policy,
            )

            if request.host_path:
                pv_spec.host_path = client.V1HostPathVolumeSource(
                    path=request.host_path
                )
            elif request.nfs_server and request.nfs_path:
                pv_spec.nfs = client.V1NFSVolumeSource(
                    server=request.nfs_server, path=request.nfs_path
                )

            pv = client.V1PersistentVolume(
                metadata=client.V1ObjectMeta(
                    name=request.name, labels=request.labels or None
                ),
                spec=pv_spec,
            )

            created = self.core_v1.create_persistent_volume(pv)

            return PVInfo(
                name=created.metadata.name,
                status=created.status.phase if created.status else "Available",
                capacity=created.spec.capacity.get("storage")
                if created.spec.capacity
                else None,
                access_modes=created.spec.access_modes or [],
                storage_class=created.spec.storage_class_name,
                reclaim_policy=created.spec.persistent_volume_reclaim_policy,
                claim=None,
                age=self.calculate_age(created.metadata.creation_timestamp),
            )
        except ApiException as e:
            logger.error(f"Error creating PV: {e}")
            raise

    async def delete_pv(self, name: str) -> ResourceDeleteResponse:
        """Delete a PersistentVolume."""
        try:
            self.core_v1.delete_persistent_volume(name)
            return ResourceDeleteResponse(
                success=True, message=f"PV {name} deleted successfully"
            )
        except ApiException as e:
            logger.error(f"Error deleting PV: {e}")
            raise

    async def get_storage_classes(self) -> List[StorageClassInfo]:
        """Get all StorageClasses."""
        try:
            storage_classes = self.storage_v1.list_storage_class()
            result = []
            for sc in storage_classes.items:
                result.append(
                    StorageClassInfo(
                        name=sc.metadata.name,
                        provisioner=sc.provisioner,
                        reclaim_policy=sc.reclaim_policy,
                        volume_binding_mode=sc.volume_binding_mode,
                        allow_volume_expansion=sc.allow_volume_expansion or False,
                        is_default="storageclass.kubernetes.io/is-default-class"
                        in (sc.metadata.annotations or {}),
                        age=self.calculate_age(sc.metadata.creation_timestamp),
                    )
                )
            return result
        except ApiException as e:
            logger.error(f"Error listing storage classes: {e}")
            raise

    async def create_storage_class(
        self, request: StorageClassCreateRequest
    ) -> StorageClassInfo:
        """Create a StorageClass."""
        try:
            annotations = {}
            if request.is_default:
                annotations["storageclass.kubernetes.io/is-default-class"] = "true"

            sc = client.V1StorageClass(
                metadata=client.V1ObjectMeta(
                    name=request.name, annotations=annotations or None
                ),
                provisioner=request.provisioner,
                reclaim_policy=request.reclaim_policy,
                volume_binding_mode=request.volume_binding_mode,
                allow_volume_expansion=request.allow_volume_expansion,
                parameters=request.parameters,
            )

            created = self.storage_v1.create_storage_class(sc)

            return StorageClassInfo(
                name=created.metadata.name,
                provisioner=created.provisioner,
                reclaim_policy=created.reclaim_policy,
                volume_binding_mode=created.volume_binding_mode,
                allow_volume_expansion=created.allow_volume_expansion or False,
                is_default="storageclass.kubernetes.io/is-default-class"
                in (created.metadata.annotations or {}),
                age=self.calculate_age(created.metadata.creation_timestamp),
            )
        except ApiException as e:
            logger.error(f"Error creating storage class: {e}")
            raise

    async def delete_storage_class(self, name: str) -> ResourceDeleteResponse:
        """Delete a StorageClass."""
        try:
            self.storage_v1.delete_storage_class(name)
            return ResourceDeleteResponse(
                success=True, message=f"StorageClass {name} deleted successfully"
            )
        except ApiException as e:
            logger.error(f"Error deleting storage class: {e}")
            raise
